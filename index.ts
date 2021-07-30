import { PrismaClient, Prisma } from '@prisma/client'
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
  await api.isReady
  await api.rpc.chain.subscribeFinalizedHeads(addFinalizedHead);
}

async function addFinalizedHead(header: Header) {
  const blockNum = header.number.toNumber();
  let blockModel = await prisma.chainBlock.findFirst({ where: { id: blockNum }});
  if (!blockModel) {
    const signedBlock = await api.rpc.chain.getBlock(header.hash);
    const extHeader = await api.derive.chain.getHeader(header.hash);

    let blockTimestamp = new Date();
    const records = await api.query.system.events.at(signedBlock.block.header.hash);
    const paymentInfos = await Promise.all(signedBlock.block.extrinsics.map(async ex => {
      if (ex.isSigned) return api.rpc.payment.queryInfo(ex.hash.toHex(), header.hash);
    }));
    const events: Prisma.ChainEventCreateInput[] = [];
    const extrinsics = signedBlock.block.extrinsics.map((ex, index) => {
      const { isSigned, method: { method, section } } = ex;

      if (section === "timestamp" && method === "set") {
        blockTimestamp = new Date(parseInt(ex.args[0].toString()));
      }

      let paymentInfo = paymentInfos[index];

      const exArgs = ex.method.args.map((arg, index) => {
        const argMeta = ex.meta.args[index];
        return {
          name: argMeta.name.toString(),
          type: argMeta.type.toString(),
          value: arg.toString(),
        }
      });
      let exRecords = records.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index));
      let success = true;
      exRecords.forEach((record, recordIndex) => {
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
          extrinsicIdx: index,
          section,
          method,
          data: eventData as any,
          extrinsicHash: ex.hash.toHex(),
          eventIdx: recordIndex + 1,
        });
      });

      return {
        extrinsicIndex: `${blockNum}-${index}`,
        blockNum,
        blockTimestamp,
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
        blockNum,
        logIndex: `${blockNum}-${index}`,
        logType: log.type,
        data: log.value.toHuman() as any,
      }
    });

    await prisma.chainBlock.create({
      data: {
        blockNum,
        blockTimestamp,
        hash: signedBlock.hash.toHex(),
        parentHash: signedBlock.block.header.parentHash.toHex(),
        stateRoot: signedBlock.block.header.stateRoot.toHex(),
        extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
        eventCount: records.length,
        extrinsicsCount: extrinsics.length,
        logs: {
          createMany: {
            data: logs,
          }
        },
        extrinsics: {
          createMany: {
            data: extrinsics,
          }
        },
        events: {
          createMany: {
            data: events,
          }
        },
        specVersion: 0,
        validator: extHeader?.author?.toString() || "",
      },
    });
  }
}


main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
