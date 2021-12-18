import {
  PrismaClient,
  ChainEvent,
  ChainVersion,
  ChainTransfer,
} from "@prisma/client";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { extractAuthor } from "@polkadot/api-derive/type/util";
import { HttpProvider } from "@polkadot/rpc-provider";
import {
  Call,
  BlockHash,
  FunctionArgumentMetadataLatest,
  SignedBlock,
  DispatchError,
  Event,
  AccountId,
} from "@polkadot/types/interfaces";
import { xxhashAsHex, cryptoWaitReady } from "@polkadot/util-crypto";
import { EventEmitter } from "events";
import PQueue from "p-queue";
import pEvent from "p-event";
import Heap from "heap-js";

const ENDPOINT = process.env.ENDPOINT || "ws://localhost:9944";
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 10;
const TYPE_FILE = process.env.TYPE_FILE || "../type";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 6000;
const LARGE_BYTES_SIZE = parseInt(process.env.LARGE_BYTES_SIZE) || 65536; // 64k

const emitter = new EventEmitter();
const prisma = new PrismaClient();
const finalizedQueue = new Heap<number>();
const newQueue = new Heap<number>();
const sessionValidators = new Map<number, AccountId[]>();

let apiWs: ApiPromise;
let apiRpc: ApiPromise;
const chainSpecVersions = new Map<number, ChainVersion>();
let syncBlockNum = 0;
let loadingSpecAt = 0;

async function main() {
  await createApi();
  await loadChainVersions();
  if (process.env.DEBUG_BLOCK) {
    await saveBlock(parseInt(process.env.DEBUG_BLOCK), SaveBlockMode.Force);
    process.exit(0);
  }
  await syncBlocks();
  runFinalizedQueue();
  runNewQueue();
  listenBlocks();
}

async function createApi() {
  const providerWs = new WsProvider(ENDPOINT);
  const providerRpc = process.env.ENDPOINT_RPC
    ? new HttpProvider(process.env.ENDPOINT_RPC)
    : providerWs;
  let options = {};
  try {
    options = { ...require(TYPE_FILE) };
    log(`UseTypes`, "yes");
  } catch {
    log(`UseTypes`, "no");
  }
  [apiWs, apiRpc] = await Promise.all([
    ApiPromise.create({ provider: providerWs, ...options }),
    ApiPromise.create({ provider: providerRpc, ...options }),
  ]);
  await Promise.all([cryptoWaitReady(), apiWs.isReady, apiRpc.isReady]);
}

async function loadChainVersions() {
  const chainVersions = await prisma.chainVersion.findMany();
  for (const chainVersion of chainVersions) {
    chainSpecVersions.set(chainVersion.specVersion, chainVersion);
  }
}

async function syncBlocks() {
  const latestBlockNum = (
    await apiWs.derive.chain.bestNumberFinalized()
  ).toNumber();
  const start = syncBlockNum;
  const end = Math.min(syncBlockNum + BATCH_SIZE, latestBlockNum);
  const blockNums = await getMissBlocks(start, end);
  log(`SyncBlocks`, `${blockNums.length} blocks from ${start} to ${end}`);
  if (blockNums.length > 0) {
    await batchSaveBlocks(blockNums);
  }
  if (end < latestBlockNum) {
    syncBlockNum = end;
    return syncBlocks();
  }
  const { isSyncing } = await apiRpc.rpc.system.health();
  if (isSyncing.isTrue) {
    syncBlockNum = end;
    await syncBlocks();
  }
  syncBlockNum = latestBlockNum - 1;
}

async function getMissBlocks(start: number, end: number) {
  const blocks = await prisma.chainBlock.findMany({
    where: {
      blockNum: { gte: start, lte: end },
    },
    select: { blockNum: true, finalized: true },
    orderBy: { blockNum: "asc" },
  });
  const blockNums = new Set(
    Array.from({ length: end - start }, (_, i) => start + i)
  );
  const unfinalized = [];
  for (const item of blocks) {
    if (item.finalized) {
      blockNums.delete(item.blockNum);
    } else {
      unfinalized.push(item.blockNum);
    }
  }
  if (unfinalized.length > 0) {
    await prisma.chainBlock.deleteMany({
      where: { blockNum: { in: unfinalized } },
    });
  }
  return Array.from(blockNums);
}

async function batchSaveBlocks(blockNums: number[]) {
  const saveBlockNum = async (blockNum: number) => {
    await saveBlock(blockNum, SaveBlockMode.Sync);
  };
  const queue = new PQueue({ concurrency: CONCURRENCY, timeout: 90000 });
  blockNums.map((v) => queue.add(() => saveBlockNum(v)));
  await queue.onIdle();
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
  apiWs.rpc.chain.subscribeFinalizedHeads((header) => {
    finalizedQueue.push(header.number.toNumber());
  });
  apiWs.rpc.chain.subscribeNewHeads((header) => {
    newQueue.push(header.number.toNumber());
  });
}

enum SaveBlockMode {
  New,
  Sync,
  Finalize,
  Force,
}

async function saveBlock(blockNum: number, mode: SaveBlockMode) {
  const blockHash = await apiRpc.rpc.chain.getBlockHash(blockNum);
  let isNew = true;
  const finalized = mode !== SaveBlockMode.New;
  try {
    if (mode !== SaveBlockMode.Sync) {
      const chainBlock = await prisma.chainBlock.findFirst({
        where: { blockNum },
      });
      if (chainBlock) {
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
            log(`FinalizeBlock`, `${blockNum} ${blockHash}`);
          }
          return;
        } else {
          await prisma.chainBlock.delete({ where: { blockNum } });
          isNew = false;
        }
      }
    }
    let blockAt = 0;
    const [signedBlock, sessionIndex, records, runtimeVersion] =
      await Promise.all([
        apiRpc.rpc.chain.getBlock(blockHash),
        apiRpc.query.session.currentIndex.at(blockHash),
        apiRpc.query.system.events.at(blockHash),
        apiRpc.rpc.state.getRuntimeVersion(blockHash),
      ]);
    const paymentInfos = await Promise.all(
      signedBlock.block.extrinsics.map(async (ex) => {
        if (ex.isSigned) {
          return apiRpc.rpc.payment.queryInfo(ex.toHex(), blockHash);
        }
      })
    );

    const blockSpecVersion = runtimeVersion.specVersion.toNumber();
    let chainVersion = chainSpecVersions.get(blockSpecVersion);
    if (!chainVersion) {
      chainVersion = await loadSpecVersion(blockHash, blockSpecVersion);
    }

    const events: ChainEvent[] = [];
    const transfers: ChainTransfer[] = [];
    let extrinsicError: any;
    const extrinsicsCount = signedBlock.block.extrinsics.length;
    const extrinsics = signedBlock.block.extrinsics.map((ex, exIndex) => {
      const {
        isSigned,
        method: { method, section },
      } = ex;

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
        if (apiRpc.events.system.ExtrinsicFailed.is(event)) {
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
      validator: await getAuthor(signedBlock, sessionIndex.toNumber()),
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
    log(isNew ? "CreateBlock" : "UpdateBlock", `${blockNum} ${blockHash}`);
  } catch (err: any) {
    log(`CreateBlock`, `${blockNum} FAILED, ${err.stack}`);
  }
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

async function getAuthor(signedBlock: SignedBlock, sessionIndex: number) {
  let validators = sessionValidators.get(sessionIndex);
  if (!validators) {
    validators = await apiRpc.query.session.validators.at(
      signedBlock.block.hash
    );
    if (!sessionValidators.has(sessionIndex)) {
      sessionValidators.set(sessionIndex, validators);
      Array.from(sessionValidators.keys()).forEach((idx) => {
        if (sessionIndex - idx < 3) {
          sessionValidators.delete(idx);
        }
      });
    }
  }
  const validator = extractAuthor(signedBlock.block.header.digest, validators);
  return validator ? validator.toString() : "";
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
  let type =
    detectSpecialType(argMeta.typeName.toString()) || argMeta.type.toString();

  let value;
  if (type === "Call") {
    value = parseCallArg(calls, arg as Call);
  } else if (type === "Vec<Call>") {
    value = (arg as Call[]).map((call) => parseCallArg(calls, call));
  } else if (type === "Bytes") {
    if (arg.length > LARGE_BYTES_SIZE) {
      type = "Bytes:X";
      value = xxhashAsHex(arg, 128).toString().slice(2);
      (async () => {
        log(`SaveLargeBytes`, value);
        await prisma.chainBytes.create({
          data: { hash: value, data: Buffer.from(arg.toU8a()) },
        });
      })();
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
    return {
      type: detectSpecialType(typeName) || type,
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

async function loadSpecVersion(blockHash: BlockHash, specVersion: number) {
  const timeout = 30000;
  const specEventName = `spec:${specVersion}`;
  if (loadingSpecAt && Date.now() - loadingSpecAt < timeout) {
    await pEvent(emitter, specEventName, { timeout });

    const version = chainSpecVersions.get(specVersion);
    if (version) return version;
    return loadSpecVersion(blockHash, specVersion);
  }
  loadingSpecAt = Date.now();
  const chainMetadata = await apiRpc.rpc.state.getMetadata(blockHash);
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
  await prisma.chainVersion.create({
    data: version,
  });
  log(`SaveSpec`, specVersion.toString());
  emitter.emit(specEventName);
  loadingSpecAt = 0;
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

function detectSpecialType(typeName: string): string {
  const types = ["Balance", "AccountId", "BlockNumber"];
  if (!types.find((v) => typeName.includes(v))) return;
  if (/^Option<.+>$/.test(typeName)) typeName = typeName.slice(7, -1);
  if (/^Compact<.+>$/.test(typeName)) typeName = typeName.slice(8, -1);
  if (/<T>$/.test(typeName)) typeName = typeName.slice(0, -3);
  if (/<T as .+>::$/.test(typeName))
    typeName = typeName.replace(/<T as .+>::$/, "");
  if (/<T, I>$/.test(typeName)) typeName = typeName.slice(0, -6);
  if (/^T::/.test(typeName)) typeName = typeName.slice(3);
  if (/Of$/.test(typeName)) typeName = typeName.slice(0, -2);
  if (/For$/.test(typeName)) typeName = typeName.slice(0, -3);
  if (types.includes(typeName)) return typeName;
}

function log(topic: string, message: string) {
  console.log(topic, message);
}

main().catch((err) => console.error(err));
