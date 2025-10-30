import jwt from "jsonwebtoken";
export function authOptional(req, _res, next) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
        const token = auth.split(" ")[1];
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const id = String(payload.id ?? payload.sub ?? "");
            if (id) {
                req.user = {
                    id,
                    wallet: payload.wallet ?? null,
                    sub: payload.sub
                };
            }
        }
        catch {
            // token ไม่ถูกต้องก็ปล่อยผ่าน (optional)
        }
    }
    next();
}
