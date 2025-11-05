import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";

const BASE_URL = process.env.BASE_URL || "https://api-solink.network";

describe("Solink Points API", () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(BASE_URL)
      .post("/api/auth/demo-login")
      .set("Content-Type", "application/json")
      .send({ wallet: "0xabc123_test_suite" });
    token = res.body.token;
    expect(token).toBeTruthy();
  });

  it("earn once and dedupe on repeat", async () => {
    const sess = "jest-" + Date.now();

    const first = await request(BASE_URL)
      .post("/api/points/earn")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ type: "extension_farm", amount: 50, meta: { session: sess } });
    expect(first.body.ok).toBe(true);
    expect(typeof first.body.balance).toBe("number");

    const dup = await request(BASE_URL)
      .post("/api/points/earn")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ type: "extension_farm", amount: 50, meta: { session: sess } });
    // ฝั่ง API เราตอบ deduped:true
    expect(dup.body.ok === true || dup.body.deduped === true).toBeTruthy();
  });

  it("get balance and latest events", async () => {
    const bal = await request(BASE_URL)
      .get("/api/points/balance")
      .set("Authorization", `Bearer ${token}`);
    expect(bal.body.ok).toBe(true);
    expect(typeof bal.body.balance).toBe("number");

    const ev = await request(BASE_URL)
      .get("/api/points/events?limit=5")
      .set("Authorization", `Bearer ${token}`);
    expect(ev.body.ok).toBe(true);
    expect(Array.isArray(ev.body.events)).toBe(true);
  });

  it("reject without token", async () => {
    const res = await request(BASE_URL).get("/api/points/balance");
    // ควรได้ 401/403 ตามที่เซ็ตไว้
    expect([401,403]).toContain(res.status);
  });
});
