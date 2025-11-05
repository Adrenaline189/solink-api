-- ===============================================
-- Migration: points_unique_extfarm_session
-- Prevent duplicate point farming (extension_farm)
-- ===============================================

-- ป้องกันยิงซ้ำ (userId + meta.session) เมื่อ type='extension_farm'
-- ถ้าไม่ส่ง session จะถือว่า '__missing__' และชนกันเอง (กันยิงรัว)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_point_event_extfarm_session"
ON "PointEvent" (
  "userId",
  COALESCE((meta->>'session'), '__missing__')
)
WHERE type = 'extension_farm';
