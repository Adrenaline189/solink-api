<<<<<<< HEAD
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Setting'
      AND column_name  = 'range'
  ) THEN
    ALTER TABLE "Setting" DROP COLUMN IF EXISTS "range";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Setting'
      AND column_name  = 'timezone'
  ) THEN
    ALTER TABLE "Setting" DROP COLUMN IF EXISTS "timezone";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id"        TEXT PRIMARY KEY,
  "wallet"    TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PointEvent" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "amount"    INTEGER NOT NULL,
  "meta"      JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointEvent_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PointEvent_userId_createdAt_idx"
  ON "PointEvent" ("userId", "createdAt");
=======
/*
  Warnings:

  - The primary key for the `Setting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `range` on the `Setting` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `Setting` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Setting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,key]` on the table `Setting` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Setting` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `key` to the `Setting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `Setting` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey",
DROP COLUMN "range",
DROP COLUMN "timezone",
DROP COLUMN "updatedAt",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE INDEX "PointEvent_userId_createdAt_idx" ON "PointEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key_key" ON "Setting"("userId", "key");

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
>>>>>>> e80fbd4 (feat(points): add User & PointEvent tables)
