import jwt from "jsonwebtoken";
export function authOptional(req, _res, next) {
    try {
        const h = req.headers.authorization;
        if (!h || !h.startsWith("Bearer "))
            return next();
        const token = h.slice("Bearer ".length);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload && payload.id)
            req.user = { id: String(payload.id), wallet: payload.wallet ?? null };
    }
    catch { }
    next();
}
