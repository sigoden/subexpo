import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const { current, pageSize } = req.query;
  const currentValue = parseInt(current) || 1;
  const pageSizeValue = parseInt(pageSize) || 20;

  const [total, list] = await Promise.all(
    [
      prisma.chainBlock.count(),
      prisma.chainBlock.findMany({
        where: {},
        select: {
          blockNum: true,
          finalized: true,
          blockAt: true,
          extrinsicsCount: true,
          eventsCount: true,
          validator: true,
          blockHash: true,
        },
        orderBy: { blockNum: "desc" },
        skip: (currentValue - 1) * pageSizeValue,
        take: pageSizeValue,
      }),
    ],
  )
  res.json({total, list});
}