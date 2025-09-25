import { PrismaClient, Prisma } from "@prisma/client";
const log: Prisma.LogLevel[] = ["warn", "error"];

export const prismaWrite = new PrismaClient({
  log,
  datasources: { db: { url: process.env.DATABASE_URL! } }, // direct
});

export const prismaRead = new PrismaClient({
  log,
  datasources: { db: { url: process.env.READONLY_POOL_URL || process.env.DATABASE_POOL_URL! } }, // pooled
});
