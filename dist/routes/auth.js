import jwt from "jsonwebtoken";
export default function mountAuth(router) {
    // ตัวอย่าง demo-login เพื่อออก token ทดสอบ
    router.post("/auth/demo-login", async (req, res) => {
        try {
            const wallet = req.body?.wallet || null;
            // สมมุติหรือตรวจ user จาก DB ตามจริงก็ได้
            const id = wallet ? wallet.slice(0, 16) : "guest";
            const token = jwt.sign({ sub: id, wallet }, process.env.JWT_SECRET, { expiresIn: "7d" });
            res.json({ ok: true, token });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e) });
        }
    });
}
