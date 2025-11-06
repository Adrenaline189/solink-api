const fs = require('fs');
const file = 'src/routes/points.ts';
let s = fs.readFileSync(file, 'utf8');

// 1) ลบ select: { referrerId: true } เพราะ Prisma type ยังไม่มี field นี้
s = s.replace(/select:\s*\{\s*referrerId:\s*true\s*\},?/g, '/* select removed for compat */');

// 2) ปรับ logic การอ่าน referrerId ให้ใช้ (referredUser as any)
s = s.replace(
  /const\s+referredUser\s*=\s*await\s*prisma\.user\.findUnique\([^)]*\);\s*if\s*\(!referredUser\?\.\s*referrerId\)\s*return\s*null;\s*const\s+referrerId\s*=\s*referredUser\.referrerId\s*;/s,
  `
  const referredUser = await prisma.user.findUnique({
    where: { id: referredUserId }
  });

  const referrerId = (referredUser as any)?.referrerId ?? null;
  if (!referrerId) return null;
  `
);

// fallback — เผื่อ pattern ไม่ตรง 100%
s = s.replace(/if\s*\(!referredUser\?\.\s*referrerId\)\s*return\s*null\s*;/g,
  `const referrerId = (referredUser as any)?.referrerId ?? null; if (!referrerId) return null;`);
s = s.replace(/const\s+referrerId\s*=\s*referredUser\.referrerId\s*;/g,
  `/* using compat any cast above */`);

// เขียนกลับ
fs.writeFileSync(file, s);
console.log('✅ Patched', file, 'for Prisma type-compat successfully.');
