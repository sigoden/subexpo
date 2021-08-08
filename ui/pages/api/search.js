import prisma from "../../lib/prisma";

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