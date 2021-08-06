import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  const [blocks, events] = await Promise.all([
    prisma.chainBlock.findMany({
      orderBy: {
        blockNum: "desc",
      },
      select: {
        blockNum: true,
        blockAt: true,
        eventsCount: true,
        extrinsicsCount: true,
        finalized: true,
      },
      take: 10,
    }),
    prisma.chainEvent.findMany({
      orderBy: {
        blockNum: "desc",
      },
      select: {
        eventId: true,
        blockNum: true,
        section: true,
        method: true,
      },
      take: 20,
    })
  ]);
  res.json({
    events,
    blocks,
  });
}