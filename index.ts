import { PrismaClient, ChainEvent } from '@prisma/client'
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Header } from "@polkadot/types/interfaces";
const types = require("./types");

const prisma = new PrismaClient()

let api: ApiPromise;

// A `main` function so that you can use async/await
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
  const signedBlock = await api.rpc.chain.getBlock(header.hash);
  const extHeader = await api.derive.chain.getHeader(header.hash);
  const records = await api.query.system.events.at(signedBlock.block.header.hash);
  const runtimeVersion = await api.rpc.state.getRuntimeVersion(header.hash);
  const paymentInfos = await Promise.all(signedBlock.block.extrinsics.map(async ex => {
    if (ex.isSigned) {
      return api.rpc.payment.queryInfo(ex.toHex(), header.hash.toHex());
    }
  }));
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
        eventIndex: `${blockNum}-${recordIndex}`,
        blockNum,
        blockAt,
        blockHash,
        extrinsicIdx: index,
        section,
        method,
        data: eventData as any,
        extrinsicHash: ex.hash.toHex(),
      });
    });

    return {
      extrinsicIndex: `${blockNum}-${index}`,
      blockNum,
      blockAt,
      blockHash,
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

  await prisma.chainBlock.create({
    data: {
      blockNum,
      blockAt,
      blockHash,
      parentHash: signedBlock.block.header.parentHash.toHex(),
      stateRoot: signedBlock.block.header.stateRoot.toHex(),
      extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
      eventCount: records.length,
      extrinsicsCount: extrinsics.length,
      specVersion: runtimeVersion.specVersion.toNumber(),
      validator: extHeader?.author?.toString() || "",
      finalized,
    },
  });

  await prisma.chainExtrinsic.createMany({
    data: extrinsics,
  });
  await prisma.chainLog.createMany({
    data: logs,
  });
  await prisma.chainEvent.createMany({
    data: events,
  });
  console.log(`SaveBlock: blockNum=${blockNum} blockHash=${blockHash} finalized=${finalized}`);
}


main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
