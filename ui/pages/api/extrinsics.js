import getPrisma from "../../lib/prisma";

export default async function handler(req, res) {
  const prisma = getPrisma();
  const { current, pageSize, section, method, startDate, endDate, accountId } =
    req.query;
  const currentValue = parseInt(current) || 1;
  const pageSizeValue = parseInt(pageSize) || 20;
  const startDateValue = parseInt(startDate);
  const endDateValue = parseInt(endDate);
  let where = {};
  if (section) {
    where.section = section;
    if (method) where.method = method;
  } else {
    where.kind = { lt: 90 };
  }
  if (startDateValue) where.blockAt = { gte: startDateValue };
  if (endDateValue) {
    if (where.blockAt) {
      where.blockAt.lt = endDateValue;
    } else {
      where.blockAt = { lt: endDateValue };
    }
  }
  if (accountId) {
    where.accountId = accountId;
  }
  if (section && method) {
    let originWhere = where;
    let callsWhere = {
      ...Object.keys(originWhere)
        .filter((v) => ["section", "method"].indexOf(v) === -1)
        .reduce((acc, cur) => {
          acc[cur] = originWhere[cur];
          return acc;
        }, {}),
      calls: { contains: `;${section}.${method}` },
    };
    where = {
      OR: [originWhere, callsWhere],
    };
  }

  const [total, list] = await Promise.all([
    prisma.chainExtrinsic.count({ where }),
    prisma.chainExtrinsic.findMany({
      where,
      select: {
        extrinsicId: true,
        blockNum: true,
        accountId: true,
        blockAt: true,
        success: true,
        section: true,
        method: true,
        args: true,
      },
      orderBy: { blockNum: "desc" },
      skip: (currentValue - 1) * pageSizeValue,
      take: pageSizeValue,
    }),
  ]);
  res.json({ total, list });
}
