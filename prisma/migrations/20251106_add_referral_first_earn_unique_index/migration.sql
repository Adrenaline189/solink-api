-- Guard: one-time bonus for first earn per referred user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_point_referral_firstearn
ON "PointEvent" ((COALESCE(("meta"->>'referredUserId'), '')))
WHERE "type" = 'referral_bonus';
