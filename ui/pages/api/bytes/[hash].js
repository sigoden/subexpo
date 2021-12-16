import getPrisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const { hash } = req.query;
  const prisma = getPrisma();
  const { data } = await prisma.chainBytes.findUnique({
    where: { hash },
  });
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-disposition": "attachment;filename=" + hash,
    "Content-Length": data.length,
  });
  res.end(data);
}
