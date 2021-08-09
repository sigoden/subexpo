import prisma from "../../lib/prisma";
import { createApi } from "../../lib/api";

export default async function handler(req, res) {
  const { q: value } = req.query;
  const kind = await detectKind(value);
  res.json({kind, value});
}

async function detectKind(value) {
  if (typeof value !== "string") return
  const blockNum = parseInt(value);
  if (blockNum > -1) {
    const block = prisma.chainBlock.findFirst({ where: { blockNum }});
    if (!block) return;
    return "block";
  }
  if (value.length === 48) {
    const api = await createApi();
    const accountInfo = await api.query.system.account(value);
    if (accountInfo) return "account";
  }
  const [block, extrinsic] = await Promise.all([
    prisma.chainBlock.findFirst({ where: { blockHash: value }}),
    prisma.chainExtrinsic.findFirst({ where: { extrinsics: value }}),
  ]);
  if (block) {
    return "block";
  }
  if (extrinsic) {
    return "extrinsic"
  }
}