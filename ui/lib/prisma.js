import { PrismaClient } from "@prisma/client";

/**
 * @returns {PrismaClient}
 */
export default function getPrisma() {
  if (global.prisma) return global.prisma;
  const prisma = (global.prisma = new PrismaClient());
  return prisma;
}

export async function getLatestBLocksAndEvents() {
  const prisma = getPrisma();
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
        extrinsicId: true,
        blockNum: true,
        section: true,
        method: true,
      },
      take: 20,
    }),
  ]);
  return { blocks, events };
}
