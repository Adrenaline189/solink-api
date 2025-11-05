-- 20251104160116_add_user_and_point_event (safe)

-- 1) ปรับตาราง Setting แบบปลอดภัย (ถ้ามีคอลัมน์เก่าอยู่ค่อยลบ)
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

-- 2) ตาราง User (ถ้าไม่มีให้สร้าง)
CREATE TABLE IF NOT EXISTS "User" (
  "id"        TEXT PRIMARY KEY,
  "wallet"    TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) ตาราง PointEvent (ถ้าไม่มีให้สร้าง)
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

-- 4) ดัชนีเพื่อการ query เร็วขึ้น
CREATE INDEX IF NOT EXISTS "PointEvent_userId_createdAt_idx"
  ON "PointEvent" ("userId", "createdAt");
