import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: [
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

prisma.$on("error", (e) => console.error("[PrismaError]", e));
prisma.$on("warn", (e) => console.warn("[PrismaWarn]", e));
