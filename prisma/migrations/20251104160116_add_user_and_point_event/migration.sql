-- Safe, idempotent migration for Setting / User / PointEvent
-- - รองรับสถานะฐานหลายแบบ (มี/ไม่มีคอลัมน์เดิม, มี/ไม่มี PK เดิม)
-- - รันซ้ำได้โดยไม่พัง

------------------------------------------------------------
-- 1) ปรับโครงสร้างตาราง "Setting" แบบปลอดภัย
------------------------------------------------------------
DO $$
DECLARE
  pk_on_userid boolean;
  has_id       boolean;
  has_key      boolean;
  has_value    boolean;
BEGIN
  -- 1.1 ลบคอลัมน์เก่าถ้ามี
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='Setting' AND column_name='range') THEN
    EXECUTE 'ALTER TABLE "Setting" DROP COLUMN IF EXISTS "range"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='Setting' AND column_name='timezone') THEN
    EXECUTE 'ALTER TABLE "Setting" DROP COLUMN IF EXISTS "timezone"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='Setting' AND column_name='updatedAt') THEN
    EXECUTE 'ALTER TABLE "Setting" DROP COLUMN IF EXISTS "updatedAt"';
  END IF;

  -- 1.2 เพิ่มคอลัมน์ใหม่ถ้ายังไม่มี
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='Setting' AND column_name='id') INTO has_id;
  IF NOT has_id THEN
    EXECUTE 'ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "id" TEXT';
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='Setting' AND column_name='key') INTO has_key;
  IF NOT has_key THEN
    EXECUTE 'ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "key" TEXT';
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='Setting' AND column_name='value') INTO has_value;
  IF NOT has_value THEN
    EXECUTE 'ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "value" TEXT';
  END IF;

  -- 1.3 ทำให้ userId เป็น NULL ได้ (เผื่อเคย NOT NULL)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='Setting' AND column_name='userId') THEN
    EXECUTE 'ALTER TABLE "Setting" ALTER COLUMN "userId" DROP NOT NULL';
  END IF;

  -- 1.4 ตั้งค่า id ให้ไม่เป็น NULL ด้วยค่า temp ถ้าแถวเดิมยังว่าง (ทำครั้งเดียว)
  IF EXISTS (SELECT 1 FROM "Setting" WHERE "id" IS NULL LIMIT 1) THEN
    EXECUTE 'UPDATE "Setting" SET "id" = COALESCE("id", gen_random_uuid()::text)';
  END IF;

  -- 1.5 ย้าย Primary Key มาอยู่ที่ id ถ้ายังเป็น userId อยู่
  SELECT EXISTS(
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = ''p''
      AND n.nspname = ''public''
      AND t.relname = ''Setting''
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = t.oid AND attname = ''userId'')
      ]::smallint[]
  ) INTO pk_on_userid;

  IF pk_on_userid THEN
    -- ลบ PK เดิม (ชื่อส่วนใหญ่คือ Setting_pkey)
    EXECUTE 'ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_pkey"';
    -- ตั้ง PK ใหม่ที่ id (ถ้ายังไม่มี)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = ''p''
        AND n.nspname = ''public''
        AND t.relname = ''Setting''
    ) THEN
      EXECUTE 'ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")';
    END IF;
  ELSE
    -- ถ้าไม่มี PK เลย ให้สร้าง PK ที่ id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = ''p''
        AND n.nspname = ''public''
        AND t.relname = ''Setting''
    ) THEN
      EXECUTE 'ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")';
    END IF;
  END IF;

  -- 1.6 สร้างดัชนี/ข้อกำหนดซ้ำ ถ้ายังไม่มี
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'Setting_key_idx'
  ) THEN
    EXECUTE 'CREATE INDEX "Setting_key_idx" ON "Setting"("key")';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'Setting_userId_key_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "Setting_userId_key_key" ON "Setting"("userId","key")';
  END IF;
END $$;

------------------------------------------------------------
-- 2) ตาราง User (สร้างถ้ายังไม่มี)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "User" (
  "id"        TEXT PRIMARY KEY,
  "wallet"    TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

------------------------------------------------------------
-- 3) ตาราง PointEvent (สร้างถ้ายังไม่มี)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PointEvent" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "amount"    INTEGER NOT NULL,
  "meta"      JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ดัชนีสำหรับ query เร็วขึ้น
CREATE INDEX IF NOT EXISTS "PointEvent_userId_createdAt_idx"
  ON "PointEvent" ("userId","createdAt");
