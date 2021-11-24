import { PrismaClient, ChainEvent, ChainVersion, ChainTransfer } from '@prisma/client'
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Call, CodecHash, FunctionArgumentMetadataV9, DispatchError } from "@polkadot/types/interfaces";
import { Header } from "@polkadot/types/interfaces";
import { MaxPriorityQueue, PriorityQueueItem } from '@datastructures-js/priority-queue'
import { Codec } from "@polkadot/types/types";
import pMap from "p-map";

const prisma = new PrismaClient()
const queue = new MaxPriorityQueue<Header>();

let api: ApiPromise;
let chainSpecVersions = new Map<number, ChainVersion>();
let syncBlockNum = 0;

async function main() {
  await startChain();
}

async function startChain() {
  await createApi();
  const chainVersions = await prisma.chainVersion.findMany();
  chainVersions.forEach(chainVersion => {
    chainSpecVersions.set(chainVersion.specVersion, chainVersion);
  });
  runQueue();
  let isSyncing = true;
  let pageIdx = 0;
  while (isSyncing) {
    pageIdx = await fixMissBlocks(pageIdx);
    isSyncing = await syncChain();
  }
  listenChain();
}

async function createApi() {
  const provider = new WsProvider(process.env.ENDPOINT);
  api = await ApiPromise.create({ provider, ...require("./type") })
  await api.isReady;
}

async function syncChain() {
  const finalizedBlockNum = await getFinalizedBlockNum();
  const lastBlockNum = await getSavedBlockNum();
  if (lastBlockNum > finalizedBlockNum) {
    console.log("Maybe need clear db?");
    process.exit(1);
  }
  const isSyncing = finalizedBlockNum - lastBlockNum > 1;
  const toSyncBlockNums = Array.from(Array(finalizedBlockNum - lastBlockNum)).map((_, i) => lastBlockNum + i);
  syncBlockNum = await batchSaveBlockNums(toSyncBlockNums);
  return isSyncing;
}

async function fixMissBlocks(pageIdx: number) {
  const lastBlockNum = await getSavedBlockNum();
  if (lastBlockNum === 0) return 0;
  const SIZE = 2000;
  let page = Math.ceil(lastBlockNum / SIZE);
  const blockNums = new Set();
  for (let i = pageIdx; i < page; i++) {
    const blocks = await prisma.chainBlock.findMany({
      where: { blockNum: { "gte": SIZE * i, "lt": SIZE * (i + 1) } },
      select: { blockNum: true },
      orderBy: { blockNum: "asc" },
      take: SIZE,
    });
    blocks.forEach(block => {
      blockNums.add(block.blockNum);
    })
  }
  const toSyncBlockNums = [];
  for (let i = pageIdx * SIZE; i <= lastBlockNum; i++) {
    if (!blockNums.has(i)) toSyncBlockNums.push(i)
  }
  await batchSaveBlockNums(toSyncBlockNums);
  return page;
}

async function batchSaveBlockNums(blockNums: number[]): Promise<number> {
  let maxBlockNum = 0;
  const concurrency = parseInt(process.env.CONCURRENCY || "") || 10;
  const saveBlockNum = async (blockNum: number) => {
    const header = await getBlockHeader(blockNum);
    await saveBlock(header, SaveBlockMode.Sync);
    maxBlockNum = Math.max(blockNum, maxBlockNum);
  }
  await pMap(blockNums, saveBlockNum, { concurrency });
  return maxBlockNum;
}

async function runQueue() {
  while (true) {
    if (queue.isEmpty()) {
      await sleep(1000);
      continue;
    }
    const { element: header } = queue.dequeue() as PriorityQueueItem<Header>;
    const blockNum = header.number.toNumber();
    for (let i = syncBlockNum; i < blockNum - 1; i++) {
      const header = await getBlockHeader(i);
      await saveBlock(header, SaveBlockMode.Finalize);
    }
    await saveBlock(header, SaveBlockMode.Finalize);
    syncBlockNum = blockNum;
  }
}

async function listenChain() {
  await api.rpc.chain.subscribeFinalizedHeads(header => {
    queue.enqueue(header, header.number.toNumber())
  });
  await api.rpc.chain.subscribeNewHeads(header => saveBlock(header, SaveBlockMode.New));
}

async function getFinalizedBlockNum() {
  const finalizedBlockHash = await api.rpc.chain.getFinalizedHead();
  const finalizedBlockHeader = await api.rpc.chain.getHeader(finalizedBlockHash);
  return finalizedBlockHeader.number.toNumber();
}

async function getSavedBlockNum() {
  const chainBlock = await prisma.chainBlock.findFirst({ where: { finalized: true }, orderBy: { blockNum: "desc" } });
  return chainBlock?.blockNum || 0;
}

async function getBlockHeader(blockNum: number) {
  const blockHash = await api.rpc.chain.getBlockHash(blockNum);
  const header = await api.rpc.chain.getHeader(blockHash);
  return header;
}

enum SaveBlockMode {
  New,
  Sync,
  Finalize,
  Force,
}

async function saveBlock(header: Header, mode: SaveBlockMode) {
  const blockNum = header.number.toNumber();
  const blockHash = header.hash.toHex();
  let isNew = true;
  const finalized = mode !== SaveBlockMode.New;
  try {
    let chainBlock = await prisma.chainBlock.findFirst({ where: { blockNum } });
    if (chainBlock) {
      if (chainBlock.blockHash === blockHash && mode !== SaveBlockMode.Force) {
        if (finalized && !chainBlock.finalized) {
          await prisma.$transaction([
            prisma.chainBlock.update({ where: { blockNum }, data: { finalized: true } }),
            prisma.chainExtrinsic.updateMany({ where: { blockNum }, data: { finalized: true } }),
          ]);
          console.log(`FinalizeBlock: ${blockNum} ${blockHash}`);
        }
        return;
      } else {
        prisma.$transaction([
          prisma.chainBlock.delete({ where: { blockNum } }),
          prisma.chainExtrinsic.deleteMany({ where: { blockNum } }),
          prisma.chainEvent.deleteMany({ where: { blockNum } }),
          prisma.chainLog.deleteMany({ where: { blockNum } }),
          prisma.chainTransfer.deleteMany({ where: { blockNum } }),
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
    let chainVersion: ChainVersion;
    if (chainSpecVersions.has(blockSpecVersion)) {
      chainVersion = chainSpecVersions.get(blockSpecVersion) as ChainVersion;
    } else {
      chainVersion = await addSpecVersion(header.hash, blockSpecVersion);
    }
    const events: ChainEvent[] = [];
    const transfers: ChainTransfer[] = [];
    let extrinsicError: any;
    let extrinsicsCount = signedBlock.block.extrinsics.length;
    const extrinsics = signedBlock.block.extrinsics.map((ex, exIndex) => {
      const { isSigned, method: { method, section } } = ex;

      if (section === "timestamp" && method === "set") {
        blockAt = Math.floor(parseInt(ex.args[0].toString()) / 1000);
      }

      let paymentInfo = paymentInfos[exIndex];
      const calls = new Set<string>();
      const exArgs = ex.method.args.map((arg, argIndex) => parseArg(calls, arg, ex.meta.args[argIndex]));
      let exEvents = records
        .map((record, recordIndex) => ({ record, recordIndex }))
        .filter(({ record: { phase } }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex));
      let success = true;
      exEvents.forEach(({ record, recordIndex }) => {
        const { event } = record;
        if (api.events.system.ExtrinsicFailed.is(event)) {
          success = false;
          const dispatchError = event.data[0];
          if (dispatchError.isModule) {
            const dispatchErrorModule = event.data[0].asModule;
            extrinsicError = lookupErrorInfo(chainVersion.rawData as any, dispatchErrorModule);
          } else {
            const dispatchErrorObj = dispatchError.toHuman() as any;
            const name = Object.keys(dispatchErrorObj)[0];
            const value = dispatchErrorObj[name];
            extrinsicError = { module: "", name, message: value };
          }
          return;
        }

        const { data, section, meta, method } = event;
        if (section === "system" && method === "ExtrinsicSuccess") {
          return;
        }
        const eventData = data.map((arg, index) => {
          const type = meta.args[index].toString();
          if (type === "DispatchError") {
            let arg_: DispatchError = arg as DispatchError;
            if (arg_.isModule) {
              let dispatchErrorModule = arg_.asModule;
              const errorInfo = lookupErrorInfo(chainVersion.rawData as any, dispatchErrorModule);
              value: return {
                type,
                value: JSON.stringify(errorInfo),
              }
            }
          }
          return {
            type,
            value: arg.toString(),
          }
        });
        events.push({
          eventId: `${blockNum}-${formatIdx(recordIndex, records.length)}`,
          blockNum,
          blockAt,
          extrinsicId: `${blockNum}-${exIndex}`,
          section,
          method,
          accountId: isSigned ? ex.signer.toString() : null,
          data: eventData as any,
        });
      });
      const extrinsicId = `${blockNum}-${formatIdx(exIndex, extrinsicsCount)}`;
      const extrinsicKind = getExtrinsicKind(section, method, isSigned);
      if (extrinsicKind === 1) {
        transfers.push({
          extrinsicId,
          blockNum,
          blockAt,
          from: ex.signer.toString(),
          to: exArgs[0].value,
          amount: exArgs[1].value,
          section,
          method,
          success,
          nonce: ex?.nonce.toNumber(),
        });
      }
      return {
        extrinsicId,
        blockNum,
        blockAt,
        extrinsicLength: ex.length,
        versionInfo: ex.version,
        method,
        section,
        calls: Array.from(calls).map(v => ";" + v).join(""),
        error: extrinsicError,
        args: exArgs as any,
        kind: extrinsicKind,
        accountId: isSigned ? ex.signer.toString() : "",
        signature: isSigned ? ex.signature.toHex() : "",
        nonce: ex?.nonce.toNumber(),
        extrinsicHash: ex.hash.toHex(),
        isSigned,
        success,
        fee: (paymentInfo ? paymentInfo.partialFee.toBigInt() : 0).toString(),
        tip: ex.tip.toBigInt().toString(),
        finalized,
      };
    });

    records
      .map((record, recordIndex) => ({ record, recordIndex }))
      .filter(({ record: { phase } }) => !phase.isApplyExtrinsic)
      .forEach(({ record, recordIndex }) => {
        const { event } = record;
        const { data, section, meta, method } = event;
        const eventData = data.map((arg, index) => {
          return {
            type: meta.args[index].toString(),
            value: arg.toString(),
          }
        });
        events.push({
          eventId: `${blockNum}-${formatIdx(recordIndex, records.length)}`,
          blockNum,
          blockAt,
          extrinsicId: null,
          section,
          method,
          accountId: null,
          data: eventData as any,
        });
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
      extrinsicsCount,
      eventsCount: events.length,
      specVersion: blockSpecVersion,
      validator: extHeader?.author?.toString() || "",
      finalized,
    };
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
      prisma.chainTransfer.createMany({
        data: transfers,
      }),
    ]);
    console.log(`${isNew ? " CreateBlock " : " UpdateBlock "}: ${blockNum} ${blockHash}`);
  } catch (err: any) {
    if (/UniqueConstraintViolation/.test(err.message)) {
    } else {
      console.log(` CreateBlock : ${blockNum} failed, ${err.message}`);
    }
  }
}

async function testBlock(blockNum: number) {
  await createApi();
  const header = await getBlockHeader(blockNum);
  await saveBlock(header, SaveBlockMode.Force);
}

function getExtrinsicKind(section: string, method: string, isSigned: boolean): number {
  if (!isSigned) {
    return 99;
  }
  const call = `${section}.${method}`;
  switch (call) {
    case "balances.transfer":
    case "balances.transferKeepAlive":
      return 1;
    default:
      return 0;
  }
}

interface ParsedArg {
  name: string;
  type: string;
  value: any;
}

function parseArg(calls: Set<string>, arg: Codec, argMeta: FunctionArgumentMetadataV9): ParsedArg {
  const name = argMeta.name.toString();
  const type = argMeta.type.toString();
  let value;
  if (type === "Call") {
    value = parseCallArg(calls, arg as Call);
  } else if (type === "Vec<Call>") {
    value = (arg as any as Call[]).map(call => parseCallArg(calls, call));
  } else {
    value = arg.toString();
  }
  return { name, type, value };
}

interface ParsedCallArg {
  section: string,
  method: string,
  args: ParsedArg[];
}

function parseCallArg(calls: Set<string>, call: Call): ParsedCallArg {
  calls.add(`${call.section}.${call.method}`);
  return {
    section: call.section,
    method: call.method,
    args: call.args.map((callArg, callArgIndex) => parseArg(calls, callArg, call.meta.args[callArgIndex])),
  }
}

async function addSpecVersion(blockHash: CodecHash, specVersion: number) {
  let version = await prisma.chainVersion.findUnique({ where: { specVersion } });
  if (version) return version;
  const [chainMetadata, lastChainVersion] = await Promise.all([
    api.rpc.state.getMetadata(blockHash),
    prisma.chainVersion.findFirst({ orderBy: { specVersion: "desc" } }),
  ]);
  if (lastChainVersion?.specVersion === specVersion) return lastChainVersion;
  const metadata = chainMetadata.toHuman().metadata as any;
  const modules = getChainModules(metadata);
  const mergedModules = lastChainVersion ? mergeChainModule(lastChainVersion.mergedModules as any as ChainModule[], modules) : modules;
  version = await prisma.chainVersion.upsert({
    where: { specVersion },
    update: {},
    create: {
      specVersion,
      modules: modules as any,
      mergedModules: mergedModules as any,
      rawData: metadata,
    },
  });
  chainSpecVersions.set(specVersion, version);
  return version;
}

interface ChainModule {
  name: string;
  calls: string[],
  errors: string[],
  events: string[],
}

function getChainModules(metadataObj: any): ChainModule[] {
  const key = Object.keys(metadataObj)[0]
  let mods = [];
  if (key === "V13") {
    for (const mod of metadataObj[key].modules) {
      mods.push({
        name: mod.name,
        calls: mod?.calls?.map((v: any) => v.name) || [],
        errors: mod?.errors?.map((v: any) => v.name) || [],
        events: mod?.events?.map((v: any) => v.name) || [],
      });
    }
  } else if (key === "V14") {
    const lookupVariantNames = (id: string) =>
      metadataObj[key].lookup.types.map((v: any) => v.id === id).type.def.Variant.variants.map((v: any) => v.name) || [];
    for (const mod of metadataObj[key].pallets) {
      mods.push({
        name: mod.name,
        calls: lookupVariantNames(mod.calls.type),
        errors: lookupVariantNames(mod.errors.type),
        events: lookupVariantNames(mod.events.type),
      })
    }
  } else {
    throw new Error(`Unsupported metadata ${key}`);
  }
  return mods;
}

interface ErrorInfo {
  module: string;
  name: string;
  message: string;
}

function lookupErrorInfo(metadataObj: any, dispatchErrorModule: any): ErrorInfo {
  const key = Object.keys(metadataObj)[0]
  if (key === "V13") {
    const module = metadataObj[key].modules.find((v: any) => v.index === dispatchErrorModule.index.toString());
    const error = module.errors[dispatchErrorModule.error.toNumber()];
    return { module: module.name, name: error.name, message: error.docs.join("").trim() };
  } else if (key === "V14") {
    const module = metadataObj[key].pallets.find((v: any) => v.index === dispatchErrorModule.index.toString());
    const error = metadataObj[key].lookup.types
      .find((v: any) => v.id === module.errors.type).type.def.Variant.variants
      .find((v: any) => v.index === dispatchErrorModule.error.toString());
    return { module: module.name, name: error.name, message:  error.docs.join("").trim() };
  } else {
    throw new Error(`Unsupported metadata ${key}`);
  }
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

function formatIdx(idx: number, count: number) {
  const numDigits = (count - 1).toString().length;
  return ("0".repeat(numDigits) + idx.toString()).slice(-1 * numDigits);
}

main().catch(err => console.error(err));