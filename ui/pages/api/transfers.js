import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const { current, pageSize, accountId } = req.query;
  const currentValue = parseInt(current) || 1;
  const pageSizeValue = parseInt(pageSize) || 20;
  const [list, total] = await Promise.all([
    await prisma.chainTransfer.findMany({
      where: {
        OR: [
          { from: accountId },
          { to: accountId },
        ]
      },
      orderBy: { blockNum: "desc" },
      skip: (currentValue - 1) * pageSizeValue,
      take: pageSizeValue,
    }),
    await prisma.chainTransfer.count({
      where: {
        OR: [
          { from: accountId },
          { to: accountId },
        ]
      },
    }),
  ]);
  res.json({list, total})
}