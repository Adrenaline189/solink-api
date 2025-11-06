const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE_URL length =', (process.env.DATABASE_URL||'').length);

  // 1) ชนิดคอลัมน์ type ของ PointEvent
  const col = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='PointEvent' AND column_name='type'
  `;
  console.log('\n[PointEvent.type]');
  console.table(col);

  // 1.1) ถ้าเป็น ENUM ให้ดูรายการค่าที่อนุญาต
  const udt = col?.[0]?.udt_name;
  if (udt) {
    const enumVals = await prisma.$queryRaw`
      SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = ${udt}
      GROUP BY t.typname
    `;
    console.log('\n[ENUM labels of PointEvent.type]');
    console.table(enumVals);
  }

  // 2) referrerId ของ userA, userD
  const refs = await prisma.$queryRaw`
    SELECT id, "referrerId" FROM "User" WHERE id IN ('userA','userD') ORDER BY id
  `;
  console.log('\n[User.referrerId]');
  console.table(refs);

  // 3) จำนวนอีเวนต์ของ userD (ต้องเป็น 0 เพื่อให้ครั้งถัดไปถือว่า "ครั้งแรก")
  const dCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS d_events FROM "PointEvent" WHERE "userId"='userD'
  `;
  console.log('\n[userD events count]');
  console.table(dCount);

  // 4) เช็คว่ามี referral_bonus ของ userA แล้วหรือยัง
  const aRefBonus = await prisma.$queryRaw`
    SELECT "id","type","amount","meta","createdAt"
    FROM "PointEvent"
    WHERE "userId"='userA' AND "type"='referral_bonus'
    ORDER BY "createdAt" DESC
    LIMIT 5
  `;
  console.log('\n[Latest referral_bonus for userA]');
  console.table(aRefBonus);
}

main().catch(e => {
  console.error(e);
}).finally(() => prisma.$disconnect());
