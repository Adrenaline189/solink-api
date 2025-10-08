// Simple health runner (Node 20+ has global fetch)
const base = process.env.API_BASE || "https://api-solink.network";
async function get(path) {
  const r = await fetch(base + path, { headers: { "accept": "application/json" } });
  const text = await r.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, path, body };
}
(async () => {
  try {
    const a = await get("/api/health");
    const b = await get("/api/health/db");
    const c = await get("/api/settings");
    console.log(JSON.stringify({ a, b, c }, null, 2));
    if (!a.ok || !b.ok || !c.ok) process.exit(1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();