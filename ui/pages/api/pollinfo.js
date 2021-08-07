import { getLatestBLocksAndEvents } from "../../lib/prisma";

export default async function handler(req, res) {
  const { events, blocks } = await getLatestBLocksAndEvents();
  res.json({ events, blocks });
}