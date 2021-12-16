import {
  PrismaClient,
  ChainEvent,
  ChainVersion,
  ChainTransfer,
} from "@prisma/client";
import { ApiPromise, WsProvider } from "@polkadot/api";
import {
  Call,
  BlockHash,
  FunctionArgumentMetadataLatest,
  DispatchError,
  Event,
} from "@polkadot/types/interfaces";
import { xxhashAsHex, cryptoWaitReady } from "@polkadot/util-crypto";
import createDebug from "debug";
import Heap from "heap-js";
import pMap from "p-map";

const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 10;
const TYPE_FILE = process.env.TYPE_FILE || "../type";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 3000;
const LARGE_BYTES_SIZE = parseInt(process.env.LARGE_BYTES_SIZE) || 65536; // 64k

const debug = createDebug("subexpo");
const prisma = new PrismaClient();
const finalizedQueue = new Heap<number>();
const newQueue = new Heap<number>();
const addingSpecVersion = new Set<number>();

let api: ApiPromise;
const chainSpecVersions = new Map<number, ChainVersion>();
let syncBlockNum = 0;

async function main() {
  if (process.env.DEBUG_BLOCK) {
    debug(`test block ${process.env.DEBUG_BLOCK}`);
    await testBlock(parseInt(process.env.DEBUG_BLOCK));
  } else {
    await boostrap();
  }
}

async function boostrap() {
  await createApi();
  await loadChainVersions();
  runFinalizedQueue();
  runNewQueue();
  await syncBlocks();
  listenBlocks();
}

async function createApi() {
  const provider = new WsProvider(process.env.ENDPOINT);
  let options = {};
  try {
    options = { ...require(TYPE_FILE) };
    debug(`load type file`);
  } catch {
    debug(`not load type file`);
  }
  api = await ApiPromise.create({ provider, ...options });
  await Promise.all([cryptoWaitReady(), api.isReady]);
  debug(`polkdaot api is ready`);
}

async function loadChainVersions() {
  const chainVersions = await prisma.chainVersion.findMany();
  for (const chainVersion of chainVersions) {
    chainSpecVersions.set(chainVersion.specVersion, chainVersion);
  }
  debug(`loaded chain versions`);
}

async function syncBlocks() {
  debug(`syncing blocks`);
  const finalizedBlockNum = await getFinalizedBlockNum();
  const start = syncBlockNum;
  const end = Math.min(syncBlockNum + BATCH_SIZE, finalizedBlockNum + 1);
  const blockNums = await getMissBlocks(start, end);
  if (blockNums.length > 0) {
    syncBlockNum = await batchSaveBlocks(blockNums);
  }
  if (syncBlockNum < finalizedBlockNum) {
    return syncBlocks();
  }
  debug(`synced blocks`);
}

async function getMissBlocks(start: number, end: number) {
  const result = [];
  const blocks = await prisma.chainBlock.findMany({
    where: {
      blockNum: { gte: start, lt: end },
    },
    select: { blockNum: true },
    orderBy: { blockNum: "asc" },
  });
  const blockNums = new Set(blocks.map((block) => block.blockNum));
  for (let i = start; i < end; i++) {
    if (!blockNums.has(i)) result.push(i);
  }
  debug(`miss ${result.length} blocks from ${start} to ${end}`);
  return result;
}

async function batchSaveBlocks(blockNums: number[]): Promise<number> {
  debug(`batch saving ${blockNums.length} blocks`);
  let maxBlockNum = 0;
  const saveBlockNum = async (blockNum: number) => {
    await saveBlock(blockNum, SaveBlockMode.Sync);
    maxBlockNum = Math.max(blockNum, maxBlockNum);
  };
  await pMap(blockNums, saveBlockNum, { concurrency: CONCURRENCY });
  debug(`batch saved ${blockNums.length} blocks`);
  return maxBlockNum;
}

async function runFinalizedQueue() {
  while (true) {
    if (finalizedQueue.length === 0) {
      await sleep(1000);
      continue;
    }
    finalizedQueue;
    const blockNum = finalizedQueue.pop();
    for (let i = syncBlockNum + 1; i <= blockNum; i++) {
      await saveBlock(blockNum, SaveBlockMode.Finalize);
      syncBlockNum = blockNum;
    }
  }
}

async function runNewQueue() {
  while (true) {
    if (newQueue.length === 0) {
      await sleep(1000);
      continue;
    }
    const blockNum = newQueue.pop();
    await saveBlock(blockNum, SaveBlockMode.New);
  }
}

function listenBlocks() {
  debug(`listening blocks`);
  api.rpc.chain.subscribeFinalizedHeads((header) => {
    finalizedQueue.push(header.number.toNumber());
  });
  api.rpc.chain.subscribeNewHeads((header) => {
    newQueue.push(header.number.toNumber());
  });
}

async function getFinalizedBlockNum() {
  const finalizedBlockHash = await api.rpc.chain.getFinalizedHead();
  const finalizedBlockHeader = await api.rpc.chain.getHeader(
    finalizedBlockHash
  );
  return finalizedBlockHeader.number.toNumber();
}

enum SaveBlockMode {
  New,
  Sync,
  Finalize,
  Force,
}

async function saveBlock(blockNum: number, mode: SaveBlockMode) {
  debug(`saving block ${blockNum} in mode ${mode}`);
  const blockHash = await api.rpc.chain.getBlockHash(blockNum);
  let isNew = true;
  const finalized = mode !== SaveBlockMode.New;
  try {
    const chainBlock = await prisma.chainBlock.findFirst({
      where: { blockNum },
    });
    if (chainBlock) {
      debug(`block ${blockNum} exists`);
      if (
        chainBlock.blockHash === blockHash.toHex() &&
        mode !== SaveBlockMode.Force
      ) {
        if (finalized && !chainBlock.finalized) {
          await prisma.$transaction([
            prisma.chainBlock.update({
              where: { blockNum },
              data: { finalized: true },
            }),
            prisma.chainExtrinsic.updateMany({
              where: { blockNum },
              data: { finalized: true },
            }),
          ]);
          console.log(`FinalizeBlock: ${blockNum} ${blockHash}`);
        }
        return;
      } else {
        debug(`delete block ${blockNum}`);
        await prisma.chainBlock.delete({ where: { blockNum } });
        isNew = false;
      }
    }
    let blockAt = 0;
    const [signedBlock, extHeader, records, runtimeVersion] = await Promise.all(
      [
        api.rpc.chain.getBlock(blockHash),
        api.derive.chain.getHeader(blockHash),
        api.query.system.events.at(blockHash),
        api.rpc.state.getRuntimeVersion(blockHash),
      ]
    );
    const paymentInfos = await Promise.all(
      signedBlock.block.extrinsics.map(async (ex) => {
        if (ex.isSigned) {
          return api.rpc.payment.queryInfo(ex.toHex(), blockHash);
        }
      })
    );
    const blockSpecVersion = runtimeVersion.specVersion.toNumber();
    let chainVersion = chainSpecVersions.get(blockSpecVersion);
    if (!chainVersion) {
      chainVersion = await addSpecVersion(blockHash, blockSpecVersion);
    }

    debug(`block ${blockNum}: parsing`);
    const events: ChainEvent[] = [];
    const transfers: ChainTransfer[] = [];
    let extrinsicError: any;
    const extrinsicsCount = signedBlock.block.extrinsics.length;
    const extrinsics = signedBlock.block.extrinsics.map((ex, exIndex) => {
      const {
        isSigned,
        method: { method, section },
      } = ex;
      debug(`block ${blockNum}: parse extrinsic ${section}.${method}`);

      if (section === "timestamp" && method === "set") {
        blockAt = Math.floor(parseInt(ex.args[0].toString()) / 1000);
      }

      const paymentInfo = paymentInfos[exIndex];
      const calls = new Set<string>();
      const exArgs = ex.method.args.map((arg, argIndex) =>
        parseArg(calls, arg, ex.meta.args[argIndex])
      );
      const exEvents = records
        .map((record, recordIndex) => ({ record, recordIndex }))
        .filter(
          ({ record: { phase } }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex)
        );
      let success = true;
      exEvents.forEach(({ record, recordIndex }) => {
        const { event } = record;
        const { section, method } = event;
        debug(`block ${blockNum}: parse event ${section}.${method}`);
        if (api.events.system.ExtrinsicFailed.is(event)) {
          success = false;
          const dispatchError = event.data[0] as unknown as DispatchError;
          extrinsicError = parseExtrinsicError(dispatchError, chainVersion);
          return;
        }

        if (section === "system" && method === "ExtrinsicSuccess") {
          return;
        }
        events.push({
          eventId: `${blockNum}-${formatIdx(recordIndex, records.length)}`,
          blockNum,
          blockAt,
          extrinsicId: `${blockNum}-${exIndex}`,
          section,
          method,
          accountId: isSigned ? ex.signer.toString() : null,
          data: parseEventData(event, chainVersion) as any,
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
        calls: Array.from(calls)
          .map((v) => ";" + v)
          .join(""),
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
        const { section, method } = event;
        events.push({
          eventId: `${blockNum}-${formatIdx(recordIndex, records.length)}`,
          blockNum,
          blockAt,
          extrinsicId: null,
          section,
          method,
          accountId: null,
          data: parseEventData(event, chainVersion) as any,
        });
      });

    const logs = signedBlock.block.header.digest.logs.map((log, index) => {
      let logValue = log.value.toHuman();
      if (logValue == null) logValue = [];
      return {
        logId: `${blockNum}-${index}`,
        blockNum,
        logType: log.type,
        data: logValue as any,
      };
    });
    const block = {
      blockNum,
      blockAt,
      blockHash: blockHash.toHex(),
      parentHash: signedBlock.block.header.parentHash.toHex(),
      stateRoot: signedBlock.block.header.stateRoot.toHex(),
      extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
      extrinsicsCount,
      eventsCount: events.length,
      specVersion: blockSpecVersion,
      validator: extHeader?.author?.toString() || "",
      finalized,
    };
    debug(`block ${blockNum}: ready to write db`);
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
        data: events as any,
      }),
      prisma.chainTransfer.createMany({
        data: transfers,
      }),
    ]);
    console.log(
      `${isNew ? " CreateBlock " : " UpdateBlock "}: ${blockNum} ${blockHash}`
    );
  } catch (err: any) {
    if (/UniqueConstraintViolation/.test(err.message)) {
    } else {
      console.log(` CreateBlock : ${blockNum} FAILED, ${err.message}`);
    }
  }
}

async function testBlock(blockNum: number) {
  await createApi();
  await saveBlock(blockNum, SaveBlockMode.Force);
}

function getExtrinsicKind(
  section: string,
  method: string,
  isSigned: boolean
): number {
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

function parseArg(
  calls: Set<string>,
  arg: any,
  argMeta: FunctionArgumentMetadataLatest
): ParsedArg {
  const name = argMeta.name.toString();
  let type = argMeta.type.toString();
  let value;
  if (type === "Call") {
    value = parseCallArg(calls, arg as Call);
  } else if (type === "Vec<Call>") {
    value = (arg as Call[]).map((call) => parseCallArg(calls, call));
  } else if (type === "Bytes") {
    if (arg.length > LARGE_BYTES_SIZE) {
      type = "Bytes:X";
      value = xxhashAsHex(arg, 128).toString().slice(2);
      prisma.chainBytes
        .create({ data: { hash: value, data: Buffer.from(arg.toU8a()) } })
        .catch((err) => console.log(err));
    }
  }
  return { name, type, value: value || arg.toString() };
}

interface ParsedCallArg {
  section: string;
  method: string;
  args: ParsedArg[];
}

function parseCallArg(calls: Set<string>, call: Call): ParsedCallArg {
  calls.add(`${call.section}.${call.method}`);
  return {
    section: call.section,
    method: call.method,
    args: call.args.map((callArg, callArgIndex) =>
      parseArg(calls, callArg, call.meta.args[callArgIndex])
    ),
  };
}

interface ParsedEventData {
  type: string;
  value: string;
}

function parseEventData(
  event: Event,
  chainVersion: ChainVersion
): ParsedEventData[] {
  const { data, meta } = event;
  return data.map((arg, index) => {
    let type = meta.args[index].toString();
    const typeName = meta.fields[index].typeName.toString();
    if (type.startsWith('{"_enum":{"Other":"Null"')) {
      type = "DispatchError";
    }
    if (type === "DispatchError") {
      const arg_: DispatchError = arg as DispatchError;
      if (arg_.isModule) {
        const dispatchErrorModule = arg_.asModule;
        const errorInfo = lookupErrorInfo(
          chainVersion.rawData as any,
          dispatchErrorModule
        );
        value: return {
          type,
          value: JSON.stringify(errorInfo),
        };
      }
    }
    if (typeName === "T::AccountId") {
      type = "AccountId";
    } else if (typeName === "T::BalanceId") {
      type == "Balance";
    }
    return {
      type,
      value: arg.toString(),
    };
  });
}

interface ExtrinisicError {
  module: string;
  name: string;
  message: string;
}

function parseExtrinsicError(
  dispatchError: DispatchError,
  chainVersion: ChainVersion
) {
  let result: ExtrinisicError;
  if (dispatchError.isModule) {
    const dispatchErrorModule = dispatchError.asModule;
    result = lookupErrorInfo(chainVersion.rawData as any, dispatchErrorModule);
  } else {
    const dispatchErrorObj = dispatchError.toHuman() as any;
    const name =
      typeof dispatchErrorObj === "string"
        ? dispatchErrorObj
        : dispatchErrorObj[Object.keys(dispatchErrorObj)[0]];
    result = { module: "", name, message: "" };
  }
  return result;
}

function lookupErrorInfo(
  metadataObj: any,
  dispatchErrorModule: any
): ExtrinisicError {
  const key = Object.keys(metadataObj)[0];
  if (key === "V13") {
    const module = metadataObj[key].modules.find(
      (v: any) => v.index === dispatchErrorModule.index.toString()
    );
    const error = module.errors[dispatchErrorModule.error.toNumber()];
    return {
      module: module.name,
      name: error.name,
      message: error.docs.join("").trim(),
    };
  } else if (key === "V14") {
    const module = metadataObj[key].pallets.find(
      (v: any) => v.index === dispatchErrorModule.index.toString()
    );
    const error = metadataObj[key].lookup.types
      .find((v: any) => v.id === module.errors.type)
      .type.def.Variant.variants.find(
        (v: any) => v.index === dispatchErrorModule.error.toString()
      );
    return {
      module: module.name,
      name: error.name,
      message: error.docs.join("").trim(),
    };
  } else {
    throw new Error(`Unsupported metadata ${key}`);
  }
}

async function addSpecVersion(blockHash: BlockHash, specVersion: number) {
  if (addingSpecVersion.has(specVersion)) {
    debug(`wating spec ${specVersion}`);
    let retry = 30;
    while (true) {
      const version = chainSpecVersions.get(specVersion);
      if (version) return version;
      await sleep(1000 + (Math.random() - 0.5) * 100);
      retry--;
      if (retry === 0) return addSpecVersion(blockHash, specVersion);
    }
  }
  debug(`adding spec ${specVersion} at ${blockHash.toHex()}`);
  addingSpecVersion.add(specVersion);
  const chainMetadata = await api.rpc.state.getMetadata(blockHash);
  const lastChainVersion = await prisma.chainVersion.findFirst({
    orderBy: { specVersion: "desc" },
  });
  if (lastChainVersion?.specVersion === specVersion) {
    chainSpecVersions.set(specVersion, lastChainVersion);
    return lastChainVersion;
  }
  const metadata = chainMetadata.toHuman().metadata as any;
  const modules = getChainModules(metadata);
  const mergedModules = lastChainVersion
    ? mergeChainModule(
        lastChainVersion.mergedModules as any as ChainModule[],
        modules
      )
    : modules;

  const version = {
    specVersion,
    modules: modules as any,
    mergedModules: mergedModules as any,
    rawData: metadata,
  } as ChainVersion;
  chainSpecVersions.set(specVersion, version);
  console.log(`  SaveBlock  : ${specVersion}`);
  await prisma.chainVersion.create({
    data: version,
  });
  return version;
}

interface ChainModule {
  name: string;
  calls: string[];
  errors: string[];
  events: string[];
}

function getChainModules(metadataObj: any): ChainModule[] {
  const key = Object.keys(metadataObj)[0];
  const mods = [];
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
    const lookupVariantNames = (id: string) => {
      if (!id) return [];
      const typeObj = metadataObj[key].lookup.types.find(
        (v: any) => v.id === id
      );
      return typeObj.type.def.Variant.variants.map((v: any) => v.name);
    };
    for (const mod of metadataObj[key].pallets) {
      mods.push({
        name: mod.name,
        calls: lookupVariantNames(mod.calls?.type),
        errors: lookupVariantNames(mod.errors?.type),
        events: lookupVariantNames(mod.events?.type),
      });
    }
  } else {
    throw new Error(`Unsupported metadata ${key}`);
  }
  return mods;
}

function mergeChainModule(
  mergeMods: ChainModule[],
  mods: ChainModule[]
): ChainModule[] {
  const names = mergeArr(
    mergeMods.map((v) => v.name),
    mods.map((v) => v.name)
  );
  const output: ChainModule[] = [];
  for (const name of names) {
    const mod1 = mergeMods.find((v) => v.name === name);
    const mod2 = mods.find((v) => v.name === name);
    if (mod1 && mod2) {
      output.push({
        name,
        calls: mergeArr(mod1.calls, mod2.calls),
        errors: mergeArr(mod1.errors, mod2.errors),
        events: mergeArr(mod1.events, mod2.events),
      });
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
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatIdx(idx: number, count: number) {
  const numDigits = (count - 1).toString().length;
  return ("0".repeat(numDigits) + idx.toString()).slice(-1 * numDigits);
}

main().catch((err) => console.error(err));
