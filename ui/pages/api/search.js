import { createApi } from "../../lib/api";
import getPrisma from "../../lib/prisma";

export default async function handler(req, res) {
  const { q: value } = req.query;
  const kind = await detectKind(value);
  res.json({ kind, value });
}

async function detectKind(value) {
  const prisma = getPrisma();
  if (typeof value !== "string") return "";
  if (value === "") return "";
  if (/^\d+$/.test(value)) {
    const block = await prisma.chainBlock.findFirst({
      where: { blockNum: parseInt(value) },
      select: { blockNum: true },
    });
    if (!block) return "";
    return "block";
  }
  if (value.length === 48) {
    const api = await createApi();
    const accountInfo = await api.query.system.account(value);
    console.log(accountInfo.toHuman());
    if (accountInfo.isEmpty) return "";
    return "account";
  }
  if (value.startsWith("0x") && value.length === 66) {
    const extrinsic = await prisma.chainExtrinsic.findFirst({
      where: { extrinsicHash: value },
      select: { extrinsicHash: true },
    });
    if (extrinsic) {
      return "extrinsic";
    }
    const block = await prisma.chainBlock.findFirst({
      where: { blockHash: value },
      select: { blockHash: true },
    });
    if (block) {
      return "block";
    }
  }
  return "";
}
