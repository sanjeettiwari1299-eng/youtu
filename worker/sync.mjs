// Optional private sync API. Bearer tokens are never put in URLs or stored in D1.
export const SYNC_KEYS = new Set([
  "se_list",
  "se_progress",
  "se_history",
  "se_addons",
  "se_theme",
  "se_builtin",
  "se_adshield",
  "se_sub_lang",
  "se_sub_size",
  "se_sub_offsets",
  "se_audio_pref",
  "se_autoplay_next",
  "se_next_delay",
  "se_auto_resume",
  "se_tv_navigation",
]);
const limit = 262144;
export async function handleSync(request, env = {}) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.SYNC_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const permitted = !origin || allowed.includes(origin);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    vary: "Origin",
    "x-content-type-options": "nosniff",
  };
  if (permitted && origin) headers["access-control-allow-origin"] = origin;
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (!permitted) return reply({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "access-control-allow-methods": "GET,PUT,OPTIONS",
        "access-control-allow-headers": "Authorization,Content-Type,If-Match",
      },
    });
  const url = new URL(request.url);
  if (url.search)
    return reply(
      { error: "Credentials and parameters are not accepted in URLs" },
      400,
    );
  if (url.pathname === "/api/sync/health")
    return reply(
      { service: "streameo-private-sync", version: 1, configured: !!env.DB },
      env.DB ? 200 : 503,
    );
  if (!["GET", "PUT"].includes(request.method))
    return reply({ error: "Method not allowed" }, 405);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    return reply({ error: "HTTPS required" }, 400);
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer [a-f0-9]{64}$/.test(auth))
    return reply({ error: "A 256-bit private sync secret is required" }, 401);
  if (!env.DB) return reply({ error: "Sync database is not configured" }, 503);
  if (env.SYNC_RATE_LIMITER) {
    const verdict = await env.SYNC_RATE_LIMITER.limit({
      key: request.headers.get("CF-Connecting-IP") || "unknown",
    });
    if (!verdict.success) return reply({ error: "Rate limit exceeded" }, 429);
  }
  const token = auth.slice(7);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const id = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  try {
    if (request.method === "GET") {
      const record = await env.DB.prepare(
        "SELECT data, revision, updated_at FROM sync_profiles WHERE id = ?",
      )
        .bind(id)
        .first();
      return reply(
        record
          ? {
              data: JSON.parse(record.data),
              revision: record.revision,
              ts: record.updated_at,
            }
          : { data: {}, revision: 0, ts: 0 },
      );
    }
    const revision = request.headers.get("If-Match");
    if (!/^(0|[1-9]\d{0,9})$/.test(revision || ""))
      return reply({ error: "If-Match revision required" }, 428);
    if (!/application\/json/i.test(request.headers.get("Content-Type") || ""))
      return reply({ error: "JSON required" }, 415);
    if (Number(request.headers.get("Content-Length")) > limit)
      return reply({ error: "Snapshot is too large" }, 413);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing snapshot" }, 400);
    let bytes = 0;
    const chunks = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return reply({ error: "Snapshot is too large" }, 413);
      }
      chunks.push(part.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const part of chunks) {
      buffer.set(part, offset);
      offset += part.length;
    }
    let snapshot;
    try {
      snapshot = JSON.parse(new TextDecoder().decode(buffer));
    } catch (_) {
      return reply({ error: "Invalid JSON" }, 400);
    }
    if (
      !snapshot ||
      typeof snapshot.data !== "object" ||
      !snapshot.data ||
      Array.isArray(snapshot.data)
    )
      return reply({ error: "Invalid snapshot" }, 400);
    const data = {};
    for (const [key, value] of Object.entries(snapshot.data))
      if (SYNC_KEYS.has(key)) data[key] = value;
    const ts = Date.now(),
      expected = Number(revision);
    // A single atomic conditional statement prevents lost updates on concurrent devices.
    const result = await env.DB.prepare(
      `INSERT INTO sync_profiles (id,data,revision,updated_at) SELECT ?,?,1,? WHERE ? = 0 OR EXISTS (SELECT 1 FROM sync_profiles WHERE id = ? AND revision = ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, revision=sync_profiles.revision+1, updated_at=excluded.updated_at WHERE sync_profiles.revision = ? RETURNING revision`,
    )
      .bind(id, JSON.stringify(data), ts, expected, id, expected, expected)
      .first();
    if (!result)
      return reply(
        {
          error:
            "Revision conflict. Download the latest cloud snapshot before retrying.",
        },
        409,
      );
    return reply({ revision: result.revision, ts });
  } catch (_) {
    return reply(
      { error: "Sync storage unavailable; verify the D1 migration" },
      503,
    );
  }
}
