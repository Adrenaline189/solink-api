-- Unique idempotency index for extension_farm per (userId, type, meta->>'session')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    indexname  = 'uniq_point_extfarm_session'
  ) THEN
    CREATE UNIQUE INDEX "uniq_point_extfarm_session"
      ON "PointEvent" (
        "userId",
        "type",
        (meta->>'session')
      )
      WHERE "type" = 'extension_farm';
  END IF;
END $$;
