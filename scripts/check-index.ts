import { prisma } from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='PointEvent'
      AND indexname='uniq_point_extfarm_session'
  `;
  console.log(rows);
}

main().catch((e)=>{ console.error(e); process.exit(1); })
      .finally(async()=>{ await prisma.$disconnect(); });
