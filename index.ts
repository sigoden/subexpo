import { PrismaClient, ChainEvent } from '@prisma/client'
import { ApiPromise, WsProvider } from "@polkadot/api";
import { CodecHash } from "@polkadot/types/interfaces";
import { Header } from "@polkadot/types/interfaces";
import { MaxPriorityQueue } from '@datastructures-js/priority-queue'
const types = require("./types");

const prisma = new PrismaClient()
const queue = new MaxPriorityQueue<Header>();

let api: ApiPromise;
let chainSpecVersions = new Set();
let syncBlockNum = 0;

async function main() {
  await startChain();
}

async function startChain() {
  const provider = new WsProvider(process.env.ENDPOINT);
  api = await ApiPromise.create({ provider, types })
  const chainVersions = await prisma.chainVersion.findMany();
  chainVersions.forEach(chainVersion => {
    chainSpecVersions.add(chainVersion.specVersion);
  });
  let isSyncing = true;
  await api.isReady
  runQueue();
  while (isSyncing) {
    await fixMissBlocks();
    isSyncing = await syncChain();
  }
  listenChain();
}

async function syncChain() {
  const finalizedBlockNum = await getFinalizedBlockNum();
  const lastBlockNum = await getSavedBlockNum();
  const isSyncing = finalizedBlockNum - lastBlockNum > 1;
  for (let blockNum = lastBlockNum + 1; blockNum < finalizedBlockNum; blockNum++) {
    const header = await getBlockHeader(blockNum);
    await saveBlock(header, true);
    syncBlockNum = blockNum;
  }
  return isSyncing;
}

async function fixMissBlocks() {
  const lastBlockNum = await getSavedBlockNum();
  if (lastBlockNum === 0) return; 
  let page = lastBlockNum / 1000 
  if (lastBlockNum % 1000 > 0) page += 1;
  const blockNums = new Set();
  for (let i = 0; i < page; i++) {
    const blocks = await prisma.chainBlock.findMany({
      where: { blockNum: { "gte": 1000 * i, "lt": 1000 * (i+1) } },
      select: { blockNum: true },
      orderBy: { blockNum: "asc" },
      take: 1000,
    });
    blocks.forEach(block => {
      blockNums.add(block.blockNum);
    })
  }
  for (let i = 1; i <= lastBlockNum; i++) {
    if (!blockNums.has(i)) {
      const header = await getBlockHeader(i);
      await saveBlock(header, true);
    }
  }
}

async function runQueue() {
  while (true) {
    if (queue.isEmpty()) {
      await sleep(1000);
      continue;
    }
    const { element: header } = queue.dequeue();
    const blockNum = header.number.toNumber();
    for (let i = syncBlockNum; i < blockNum - 1; i++) {
      const header = await getBlockHeader(i);
      await saveBlock(header, true);
    }
    await saveBlock(header, true);
    syncBlockNum = blockNum;
  }
}

async function listenChain() {
  await api.rpc.chain.subscribeFinalizedHeads(header => {
    queue.enqueue(header, header.number.toNumber())
  });
  await api.rpc.chain.subscribeNewHeads(header => saveBlock(header, false));
}

async function getFinalizedBlockNum() {
  const finalizedBlockHash = await api.rpc.chain.getFinalizedHead();
  const finalizedBlockHeader =  await api.rpc.chain.getHeader(finalizedBlockHash);
  return finalizedBlockHeader.number.toNumber();
}

async function getSavedBlockNum() {
  const chainBlock = await prisma.chainBlock.findFirst({ where: { finalized: true }, orderBy: { blockNum: "desc" }});
  return chainBlock?.blockNum || 0;
}

async function getBlockHeader(blockNum: number) {
  const blockHash = await api.rpc.chain.getBlockHash(blockNum);
  const header = await api.rpc.chain.getHeader(blockHash);
  return header;
}

async function saveBlock(header: Header, finalized: boolean) {
  const blockNum = header.number.toNumber();
  const blockHash = header.hash.toHex();
  let isNew = true;
  let chainBlock = await prisma.chainBlock.findFirst({ where: { blockNum }});
  if (chainBlock) {
    if (chainBlock.blockHash === blockHash ) {
      if (finalized && !chainBlock.finalized) {
        await prisma.chainBlock.update({ where: { blockNum }, data: { finalized: true }});
        console.log(`FinalizeBlock: ${blockNum} ${blockHash}`);
      }
      return;
    } else {
      prisma.$transaction([
        prisma.chainBlock.delete({ where: { blockNum }}),
        prisma.chainExtrinsic.deleteMany({ where: { blockNum }}),
        prisma.chainEvent.deleteMany({ where: { blockNum }}),
        prisma.chainLog.deleteMany({ where: { blockNum }}),
      ]);
      isNew = false;
    }
  }
  let blockAt = 0;
  const [signedBlock, extHeader, records, runtimeVersion] = await Promise.all([
    api.rpc.chain.getBlock(header.hash),
    api.derive.chain.getHeader(header.hash),
    api.query.system.events.at(header.hash),
    api.rpc.state.getRuntimeVersion(header.hash),
  ]);
  const paymentInfos = await Promise.all(signedBlock.block.extrinsics.map(async ex => {
    if (ex.isSigned) {
      return api.rpc.payment.queryInfo(ex.toHex(), header.hash.toHex());
    }
  }));
  const blockSpecVersion = runtimeVersion.specVersion.toNumber();
  if (!chainSpecVersions.has(blockSpecVersion)) {
    await addSpecVersion(header.hash, blockSpecVersion);
  }
  const events: ChainEvent[] = [];
  const extrinsics = signedBlock.block.extrinsics.map((ex, index) => {
    const { isSigned, method: { method, section } } = ex;

    if (section === "timestamp" && method === "set") {
      blockAt = Math.floor(parseInt(ex.args[0].toString()) / 1000);
    }

    let paymentInfo = paymentInfos[index];

    const exArgs = ex.method.args.map((arg, exIndex) => {
      const argMeta = ex.meta.args[exIndex];
      return {
        name: argMeta.name.toString(),
        type: argMeta.type.toString(),
        value: arg.toString(),
      }
    });
    let exEvents = records
      .map((record, recordIndex) => ({ record, recordIndex }))
      .filter(({record: { phase } }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index));
    let success = true;
    exEvents.forEach(({ record, recordIndex }, evIndex) => {
      if (api.events.system.ExtrinsicFailed.is(record.event)) {
        success = false;
      }
      
      const { data, section, meta, method } = record.event;
      if (section === "system" && method === "ExtrinsicSuccess") {
        return;
      }
      const eventData = data.map((arg, index) => {
        return {
          type: meta.args[index].toString(),
          value: arg.toString(),
        }
      });
      events.push({
        eventId: `${blockNum}-${recordIndex}`,
        blockNum,
        blockAt,
        extrinsicIdx: index,
        section,
        method,
        eventIdx: recordIndex,
        data: eventData as any,
        extrinsicHash: ex.hash.toHex(),
      });
    });

    return {
      extrinsicId: `${blockNum}-${index}`,
      blockNum,
      blockAt,
      extrinsicLength: ex.length,
      versionInfo: ex.version,
      method,
      section,
      args: exArgs as any,
      accountId: isSigned ? ex.signer.toString() : "",
      signature: isSigned ? ex.signature.toHex() : "",
      nonce: ex?.nonce.toNumber(),
      extrinsicHash: ex.hash.toHex(),
      isSigned,
      success,
      fee: paymentInfo ? paymentInfo.partialFee.toBigInt() : 0,
      tip: ex.tip.toBigInt(),
    }
  });
  const logs = signedBlock.block.header.digest.logs.map((log, index) => {
    return {
      logId: `${blockNum}-${index}`,
      blockNum,
      logType: log.type,
      data: log.value.toHuman() as any,
    }
  });
  const block = {
    blockNum,
    blockAt,
    blockHash,
    parentHash: signedBlock.block.header.parentHash.toHex(),
    stateRoot: signedBlock.block.header.stateRoot.toHex(),
    extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
    extrinsicsCount: extrinsics.length,
    eventsCount: events.length,
    specVersion: blockSpecVersion,
    validator: extHeader?.author?.toString() || "",
    finalized,
  };
  try {
    await prisma.$transaction([
      prisma.chainBlock.create({
        data: block,
      }),
      prisma.chainExtrinsic.createMany({
        data: extrinsics,
      }),
      prisma.chainLog.createMany({
        data: logs,
      }),
      prisma.chainEvent.createMany({
        data: events,
      }),
    ]);
    console.log(`${isNew ? " CreateBlock "  : " UpdateBlock " }: ${blockNum} ${blockHash}`);
  } catch (err) {
    if (/UniqueConstraintViolation/.test(err.message)) {
    } else {
      console.log(` CreateBlock : ${blockNum}, ${err.message}`);
    }
  }
}

async function addSpecVersion(blockHash: CodecHash, specVersion: number) {
  const exist = await prisma.chainVersion.count({ where: { specVersion } });
  if (exist) return;
  const latestChainVersion = await prisma.chainVersion.findFirst({ select: { mergedModules: true }, orderBy: { specVersion: "desc" }});
  const metadata = await api.rpc.state.getMetadata(blockHash);
  const wrapMetadata = metadata.toHuman() as any;
  const metadataObj = wrapMetadata.metadata[Object.keys(wrapMetadata.metadata)[0]]
  const modules = getChainModules(metadataObj) as any;
  const mergedModules = latestChainVersion ? mergeChainModule(latestChainVersion.mergedModules as any, modules) : modules;
  await prisma.chainVersion.create({
    data: {
      specVersion,
      modules,
      mergedModules,
      rawData: metadataObj,
    },
  });
  chainSpecVersions.add(specVersion);
}

interface ChainModule {
  name: string;
  calls: string[],
  errors: string[],
  events: string[],
}

function getChainModules(metadataObj: any): ChainModule[] {
  let mods = [];
  for (const mod of metadataObj.modules) {
    mods.push({
      name: mod.name,
      calls: mod?.calls?.map((v: any) => v.name) || [],
      errors: mod?.errors?.map((v: any) => v.name) || [],
      events: mod?.events?.map((v: any) => v.name) || [],
    });
  }
  return mods;
}

function mergeChainModule(mergeMods: ChainModule[], mods: ChainModule[]): ChainModule[] {
  const names = mergeArr(mergeMods.map(v => v.name), mods.map(v => v.name));
  const output: ChainModule[] = [];
  for (const name of names) {
    const mod1 = mergeMods.find(v => v.name === name);
    const mod2 = mods.find(v => v.name === name);
    if (mod1 && mod2) {
      output.push({
        name,
        calls: mergeArr(mod1.calls, mod2.calls),
        errors: mergeArr(mod1.errors, mod2.errors),
        events: mergeArr(mod1.events, mod2.events),
      })
    } else if (mod1) {
      output.push(mod1);
    } else if (mod2) {
      output.push(mod2);
    }
  }
  return output;
}

function mergeArr(array1: string[], array2: string[]) {
  return Array.from(new Set([...array1, ...array2]));
}

async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

main().catch(err => console.error(err));