import { PrismaClient } from "@prisma/client";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: 
// https://pris.ly/d/help/next-js-best-practices

/**
 * @type PrismaClient
 */
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient()
  }
  prisma = global.prisma
}
export default prisma;

export async function getLatestBLocksAndEvents() {
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
    })
  ]);
  return { blocks, events };
}