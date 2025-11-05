router.post("/points/earn", authOptional, async (req, res) => {
  // narrow ให้ชัดว่าเป็นผู้ใช้ที่ล็อกอิน และ sub เป็น string
  if (!req.user || typeof req.user.sub !== "string") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const userId: string = req.user.sub;                 // <-- คอนกรีตเป็น string
  const wallet = typeof req.user.wallet === "string" ? req.user.wallet : userId;

  try {
    const { type, amount, meta } = earnSchema.parse(req.body);

    // ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, wallet },
    });

    // create event
    const event = await prisma.pointEvent.create({
      data: { userId, type, amount, meta },            // <-- ใช้ userId (string)
    });

    const agg = await prisma.pointEvent.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    return res.json({ ok: true, event, balance: agg._sum.amount ?? 0 });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const code = err?.code;

    const duplicateHit =
      code === "P2002" ||
      msg.includes("uniq_point_extfarm_session") ||
      msg.includes("Unique constraint failed") ||
      msg.includes("COALESCE(meta ->> 'session'");

    if (duplicateHit) {
      const agg = await prisma.pointEvent.aggregate({
        where: { userId },                              // <-- ใช้ตัวแปรที่ narrowed แล้ว
        _sum: { amount: true },
      });
      return res.status(200).json({ ok: true, deduped: true, event: null, balance: agg._sum.amount ?? 0 });
    }

    console.error("[points/earn] error", err);
    return res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
  }
});

router.get("/points/balance", authOptional, async (req, res) => {
  if (!req.user || typeof req.user.sub !== "string") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const userId: string = req.user.sub;

  const agg = await prisma.pointEvent.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  res.json({ ok: true, balance: agg._sum.amount ?? 0 });
});

router.get("/points/events", authOptional, async (req, res) => {
  if (!req.user || typeof req.user.sub !== "string") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const userId: string = req.user.sub;

  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const events = await prisma.pointEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json({ ok: true, events });
});
