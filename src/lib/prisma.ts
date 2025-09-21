import { PrismaClient } from "@prisma/client";

// เก็บ instance เดียวใน dev เพื่อกันการสร้างซ้ำเวลาร้อนๆ (HMR)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // ถ้าต้องการเปิด log ค่อยเปิดทีหลัง (ขึ้นกับเวอร์ชัน Prisma)
    // log: ['error', 'warn'], // <- คอมเมนต์ไว้ก่อนกัน TS error บน Render
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// (ไม่จำเป็น แต่ช่วย Debug ได้ถ้าต้องการ)
// prisma.$on('error', (e) => console.error('[PrismaError]', e));
// prisma.$on('warn', (e) => console.warn('[PrismaWarn]', e));
