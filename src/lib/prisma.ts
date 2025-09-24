import { PrismaClient, Prisma } from "@prisma/client";

const log: Prisma.LogLevel[] = ["warn", "error"];

// เขียน/ทรานแซกชัน → ใช้ direct (DATABASE_URL)
export const prismaWrite = new PrismaClient({
  log,
  datasources: { db: { url: process.env.DATABASE_URL! } },
});

// อ่าน/health → ใช้ pooled (DATABASE_POOL_URL หรือ READONLY_POOL_URL)
export const prismaRead = new PrismaClient({
  log,
  datasources: { db: { url: process.env.READONLY_POOL_URL || process.env.DATABASE_POOL_URL! } },
});
