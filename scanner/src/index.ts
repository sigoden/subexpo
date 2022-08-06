import {
  PrismaClient,
  ChainEvent,
  ChainVersion,
  ChainTransfer,
  ChainBlob,
} from "@prisma/client";
import path from "path";
import { execSync } from "child_process";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { isU8a } from "@polkadot/util";
import { extractAuthor } from "@polkadot/api-derive/type/util";
import { HttpProvider } from "@polkadot/rpc-provider";
import {
  BlockHash,
  FunctionArgumentMetadataLatest,
  SignedBlock,
  DispatchError,
  DispatchResult,
  Event,
  AccountId,
} from "@polkadot/types/interfaces";
import { createHash } from "crypto";
import { AnyTuple, CallBase } from "@polkadot/types/types";
import { EventEmitter } from "events";
import PQueue from "p-queue";
import pEvent from "p-event";
import Heap from "heap-js";

const ENDPOINT = process.env.ENDPOINT || "ws://localhost:9944";
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 10;
const TYPES_FILE = process.env.TYPES_FILE || "../types";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 5000;
const MIN_BLOB_SIZE = parseInt(process.env.MIN_BLOB_SIZE) || 65536; // 64k

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
    options = { ...require(TYPES_FILE) };
    log(`LoadTypes`, "yes");
  } catch {
    log(`LoadTypes`, "no");
  }
  [apiWs, apiRpc] = await Promise.all([
    ApiPromise.create({ provider: providerWs, ...options }),
    ApiPromise.create({ provider: providerRpc, ...options }),
  ]);
  await Promise.all([apiWs.isReady, apiRpc.isReady]);
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
    const chainBlobs: ChainBlob[] = [];
    let extrinsicError: any;
    const extrinsicsCount = signedBlock.block.extrinsics.length;
    const extrinsics = signedBlock.block.extrinsics.map((ex, exIndex) => {
      const calls = new Set<string>();
      const blobs: BlobData[] = [];
      const { isSigned } = ex;
      const {
        method,
        section,
        args: exArgs,
      } = parseCall({ calls, blobs }, ex.method);
      blobs.map(({ hash, data }) => chainBlobs.push({ hash, data, blockNum }));

      if (section === "timestamp" && method === "set") {
        blockAt = Math.floor(parseInt(exArgs[0].value) / 1000);
      }

      const paymentInfo = paymentInfos[exIndex];
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
          args: parseEventArgs(event, chainVersion) as any,
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
          args: parseEventArgs(event, chainVersion) as any,
        });
      });

    const logs = signedBlock.block.header.digest.logs.map((log, index) => {
      const args = log.value.toHuman() || [];
      return {
        logId: `${blockNum}-${index}`,
        blockNum,
        logType: log.type,
        args: args as any,
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
      prisma.chainBlob.createMany({
        data: chainBlobs,
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

interface ParseArgsCtx {
  calls: Set<string>;
  blobs: BlobData[];
}

interface BlobData {
  hash: string;
  data: Buffer;
}

interface ParsedCallArg {
  section: string;
  method: string;
  args: ParsedArg[];
}

function parseCall(ctx: ParseArgsCtx, call: CallBase<AnyTuple>): ParsedCallArg {
  const { section, method, meta } = call;
  ctx.calls.add(`${section}.${method}`);
  return {
    section,
    method,
    args: call.args.map((callArg, callArgIndex) =>
      parseCallArgs(ctx, callArg, meta.args[callArgIndex])
    ),
  };
}

interface ParsedArg {
  name: string;
  type: string;
  value: any;
  specialType: string;
}

function parseCallArgs(
  ctx: ParseArgsCtx,
  arg: any,
  meta: FunctionArgumentMetadataLatest
): ParsedArg {
  const name = meta.name.toString();
  const type = meta.type.toString();
  const typeName = meta.typeName.toString();
  let value = arg.toString();
  let specialType = detectSpecialType(typeName || type, value);
  if (type === "Call") {
    value = parseCall(ctx, arg as CallBase<AnyTuple>);
  } else if (type === "Vec<Call>") {
    value = (arg as CallBase<AnyTuple>[]).map((call) => parseCall(ctx, call));
  } else if (type === "Bytes") {
    if (arg.length > MIN_BLOB_SIZE) {
      specialType = "Blob";
      value = md5(arg);
      ctx.blobs.push({ hash: value, data: Buffer.from(arg.toU8a()) });
    }
  }
  return { name, type, value, specialType };
}

function parseEventArgs(event: Event, chainVersion: ChainVersion): ParsedArg[] {
  const { data, meta } = event;
  return data.map((arg, index) => {
    let type = meta.args[index].toString();
    const value = arg.toString();
    const name = meta.fields[index].name.toString();
    const typeName = meta.fields[index].typeName.toString();
    const specialType = detectSpecialType(typeName || type, value);
    if (type.startsWith('{"_enum":{"Other":"Null"')) {
      type = "DispatchError";
    } else if (typeName == "DispatchResult") {
      const arg_ = arg as DispatchResult;
      if (arg_.isErr) {
        type = "DispatchError";
        arg = arg_.asErr;
      }
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
          name,
          type,
          value: JSON.stringify(errorInfo),
          specialType,
        };
      }
    }
    return {
      name,
      type,
      value,
      specialType,
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
    const errorIndex = isU8a(dispatchErrorModule.error)
      ? dispatchErrorModule.error[0].toString()
      : dispatchErrorModule.error.toString();
    const error = metadataObj[key].lookup.types
      .find((v: any) => v.id === module.errors.type)
      .type.def.Variant.variants.find((v: any) => v.index === errorIndex);
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

function detectSpecialType(type: string, value: string): string {
  if (type.includes("Balance")) {
    try {
      if (apiRpc.createType("Balance", value).toString() === value)
        return "Balance";
    } catch {}
  } else if (type.includes("BlockNumber")) {
    try {
      if (apiRpc.createType("BlockNumber", value).toString() === value)
        return "BlockNumber";
    } catch {}
  } else if (type.includes("AccountId") || type.includes("Address")) {
    try {
      if (apiRpc.createType("AccountId", value).toString() === value)
        return "AccountId";
    } catch {}
  }
}

function log(topic: string, message: string) {
  console.log(topic, message);
}

function md5(data: Buffer): string {
  return createHash("md5").update(data).digest().toString("hex");
}

if (process.env.DATABASE_SYNC) {
  const cmd = path.resolve("node_modules/.bin/prisma");
  try {
    execSync(`${cmd} db push`);
    log("SyncDatabase", "success");
  } catch (err) {
    process.exit(1);
  }
}
main().catch((err) => console.error(err));
