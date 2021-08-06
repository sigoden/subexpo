import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const kind = await detectKind(req.query.q);
  res.json({kind});
}

async function detectKind(q) {
  if (typeof q !== "string") return
  const blockNum = parseInt(q);
  if (blockNum) {
    const block = prisma.chainBlock.findFirst({ where: { blockNum }});
    if (!block) return;
    return "block";
  }
  const [block, extrinsic] = await Promise.all([
    prisma.chainBlock.findFirst({ where: { blockHash: q }}),
    prisma.chainExtrinsic.findFirst({ where: { extrinsics: q }}),
  ]);
  if (block) {
    return "block";
  }
  if (extrinsic) {
    return "extrinsic"
  }
}