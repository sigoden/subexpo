import { PrismaClient } from '@prisma/client'
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
  console.log(JSON.stringify(header.toHuman(), null, 2));
  let blockModel = await prisma.chainBlock.findFirst({ where: { id: blockNum }});
  if (!blockModel) {
    const signedBlock = await api.rpc.chain.getBlock(header.hash);
    console.log(JSON.stringify(signedBlock, null, 2));

    let blockTimestamp = 0;
    signedBlock.block.extrinsics.forEach((ex, index) => {
      // the extrinsics are decoded by the API, human-like view
      console.log(index, ex.toHuman());

      const { isSigned, method: { args, method, section } } = ex;
      if (section === "timestamp" && method === "set") {
        blockTimestamp = (args[0] as any).toNumber();
      }

      // explicit display of name, args & documentation
      console.log(`${section}.${method}(${args.map((a) => a.toString()).join(', ')})`);

      // signer/nonce info
      if (isSigned) {
        console.log(`signer=${ex.signer.toString()}, nonce=${ex.nonce.toString()}`);
      }
    });
    let logs = signedBlock.block.header.digest.logs.map(l => {
      
    });

    // await prisma.chainBlock.create({
    //   data: {
    //     blockNum,
    //     blockTimestamp: new Date().getTime(),
    //     hash: signedBlock.hash.toHex(),
    //     parentHash: signedBlock.block.header.parentHash.toHex(),
    //     stateRoot: signedBlock.block.header.stateRoot.toHex(),
    //     extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
    //     logs,
    //     extrinsics,
    //   },
    // })
  }
}


main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
