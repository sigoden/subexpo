import { PrismaClient, ChainEvent } from '@prisma/client'
import { ApiPromise, WsProvider } from "@polkadot/api";
import { CodecHash } from "@polkadot/types/interfaces";
import { Header } from "@polkadot/types/interfaces";
const types = require("./types");

const prisma = new PrismaClient()

let api: ApiPromise;
let prevSpecVersion = 0;

async function main() {
  await initApi();
}

async function initApi() {
  const provider = new WsProvider(process.env.ENDPOINT);
  api = await ApiPromise.create({ provider, types })
  let isSync = true;
  await api.isReady
  while (isSync) {
    isSync = await syncChain();
  }
  await api.rpc.chain.subscribeFinalizedHeads(header => saveBlock(header, true));
}

async function syncChain() {
  const finalizedBlockHash = await api.rpc.chain.getFinalizedHead();
  const finalizedBlockHeader =  await api.rpc.chain.getHeader(finalizedBlockHash);
  const finalizedBlockNum = finalizedBlockHeader.number.toNumber();
  const chainBlock = await prisma.chainBlock.findFirst({ where: { finalized: true }, orderBy: { blockNum: "desc" }});
  const saveBlockNum = chainBlock?.blockNum || 0;
  prevSpecVersion = chainBlock?.specVersion || 0;
  if (saveBlockNum === finalizedBlockNum) return false;
  for (let blockNum = saveBlockNum + 1; blockNum < finalizedBlockNum; blockNum++) {
    const blockHash = await api.rpc.chain.getBlockHash(blockNum);
    const header = await api.rpc.chain.getHeader(blockHash);
    await saveBlock(header, true);
  }
  return true;
}

async function saveBlock(header: Header, finalized: boolean) {
  const blockNum = header.number.toNumber();
  const blockHash = header.hash.toHex();
  let chainBlock = await prisma.chainBlock.findFirst({ where: { blockNum }});
  if (chainBlock && chainBlock.blockHash !== blockHash) {
    await Promise.all([
      prisma.chainBlock.delete({ where: { blockNum }}),
      prisma.chainExtrinsic.deleteMany({ where: { blockNum }}),
      prisma.chainEvent.deleteMany({ where: { blockNum }}),
      prisma.chainLog.deleteMany({ where: { blockNum }}),
    ]);
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
  if (blockSpecVersion > prevSpecVersion) {
    await checkSpecVersion(header.hash, blockSpecVersion);
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
      logIndex: `${blockNum}-${index}`,
      blockNum,
      logType: log.type,
      data: log.value.toHuman() as any,
    }
  });

  await prisma.$transaction([
    prisma.chainBlock.create({
      data: {
        blockNum,
        blockAt,
        blockHash,
        parentHash: signedBlock.block.header.parentHash.toHex(),
        stateRoot: signedBlock.block.header.stateRoot.toHex(),
        extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
        extrinsicsCount: extrinsics.length,
        eventCount: events.length,
        specVersion: blockSpecVersion,
        validator: extHeader?.author?.toString() || "",
        finalized,
      },
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

  console.log(`SaveBlock: blockNum=${blockNum} blockHash=${blockHash} finalized=${finalized}`);
}

async function checkSpecVersion(blockHash: CodecHash, specVersion: number) {
  const chainVersion = await prisma.chainVersion.findFirst({ where: { specVersion }});
  if (!chainVersion) {
    const metadata = await api.rpc.state.getMetadata(blockHash);
    const wrapMetadata = metadata.toHuman() as any;
    const metadataObj = wrapMetadata.metadata[Object.keys(wrapMetadata.metadata)[0]]
    await prisma.chainVersion.createMany({
      data: {
        specVersion,
        modules: metadataObj.modules.map((v: any) => v.name).join("|"),
        rawData: metadataObj,
      },
    });
  }
}


main()
  .catch(e => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  })
