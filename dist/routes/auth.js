import { Router } from "express";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
const r = Router();
const NonceReq = z.object({
    wallet: z.string().min(32).max(64),
});
const LoginReq = z.object({
    wallet: z.string().min(32).max(64),
    signature: z.string().min(64),
});
function nonceKey(wallet) {
    return `auth:nonce:${wallet}`;
}
r.post("/nonce", async (req, res) => {
    const parse = NonceReq.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ ok: false, error: "bad_request" });
    const { wallet } = parse.data;
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    await prisma.setting.upsert({
        where: { userId_key: { userId: null, key: nonceKey(wallet) } },
        create: { userId: null, key: nonceKey(wallet), value: nonce },
        update: { value: nonce },
    });
    return res.json({ ok: true, wallet, nonce });
});
r.post("/login", async (req, res) => {
    const parse = LoginReq.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ ok: false, error: "bad_request" });
    const { wallet, signature } = parse.data;
    const rec = await prisma.setting.findUnique({
        where: { userId_key: { userId: null, key: nonceKey(wallet) } },
    });
    if (!rec)
        return res.status(400).json({ ok: false, error: "nonce_not_found" });
    const nonce = rec.value;
    const message = new TextEncoder().encode(`Solink login nonce: ${nonce}`);
    const pubkey = bs58.decode(wallet);
    const sig = bs58.decode(signature);
    const ok = nacl.sign.detached.verify(message, sig, pubkey);
    if (!ok)
        return res.status(401).json({ ok: false, error: "invalid_signature" });
    await prisma.setting.delete({ where: { userId_key: { userId: null, key: nonceKey(wallet) } } });
    const token = jwt.sign({ sub: wallet }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ ok: true, token, wallet });
});
export default r;
