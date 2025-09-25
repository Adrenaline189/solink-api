import { PrismaClient, Prisma } from "@prisma/client";
const log: Prisma.LogLevel[] = ["warn", "error"];

// เขียน/migrate ใช้ direct
export const prismaWrite = new PrismaClient({
  log,
  datasources: { db: { url: process.env.DATABASE_URL! } },
});

// อ่าน/health ใช้ pooled (หรือ readonly pooled ถ้ามี)
export const prismaRead = new PrismaClient({
  log,
  datasources: { db: { url: process.env.READONLY_POOL_URL || process.env.DATABASE_POOL_URL! } },
});
