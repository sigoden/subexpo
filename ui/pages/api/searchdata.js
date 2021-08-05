import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const [version, firstBlock, lastBlock] = await Promise.all([
    prisma.chainVersion.findFirst({ orderBy: { specVersion: "desc" }, select: { mergedModules: true } }),
    prisma.chainBlock.findFirst({ orderBy: { blockNum: "asc" }, select: { blockAt: true } }),
    prisma.chainBlock.findFirst({ orderBy: { blockNum: "desc" }, select: { blockAt: true } }),
  ]);
  res.json({
    modules: version.mergedModules,
    firstBlockAt: firstBlock.blockAt,
    lastBlockAt: lastBlock.blockAt,
  });
}