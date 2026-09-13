/**
 * 旅行地图 · 数据同步后端（Cloudflare Worker）
 *
 * - 静态资源：dist 构建产物由 Workers Assets 自动托管（见 wrangler.jsonc 的 assets）
 * - /api/*：注册 / 登录 / 数据读写，每个账号一份独立的 TravelData JSON，存 KV
 * - 密码：PBKDF2-SHA256（10 万次迭代）+ 随机盐，不存明文
 * - 会话：HttpOnly Cookie + KV 里的会话令牌，30 天有效
 *
 * 部署前：
 *   npx wrangler kv namespace create MEDIA   → 把输出的 id 填进 wrangler.jsonc
 *   npx wrangler secret put REGISTER_CODE    → 设置注册邀请码（不设则注册关闭）
 */

export interface Env {
  KV: KVNamespace;
  ASSETS: Fetcher;
  REGISTER_CODE?: string;
}

const COOKIE = "sid";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 天

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const validUsername = (u: string) => /^[A-Za-z0-9_-]{2,24}$/.test(u);

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface UserRecord {
  salt: string;
  hash: string;
  createdAt: string;
}

async function createSession(env: Env, username: string): Promise<string> {
  const token = crypto.randomUUID() + "." + crypto.randomUUID().slice(0, 8);
  await env.KV.put(`session:${token}`, username, { expirationTtl: SESSION_TTL });
  return token;
}

async function sessionUser(env: Env, req: Request): Promise<string | null> {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  return env.KV.get(`session:${token}`);
}

const sessionCookie = (token: string) =>
  `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) {
      // 非 API 请求交回静态资产（index.html 等）
      return env.ASSETS.fetch(req);
    }

    try {
      return await handleApi(req, env, url.pathname);
    } catch {
      return json({ error: "服务器内部错误" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleApi(req: Request, env: Env, pathname: string): Promise<Response> {
  const method = req.method;

  // ---- 注册 ----
  if (pathname === "/api/register" && method === "POST") {
    const body = (await req.json().catch(() => null)) as { username?: string; password?: string; code?: string } | null;
    const username = (body?.username ?? "").trim();
    const password = body?.password ?? "";
    if (!env.REGISTER_CODE) return json({ error: "注册未开放：管理员未设置邀请码" }, 403);
    if (body?.code !== env.REGISTER_CODE) return json({ error: "邀请码不对" }, 403);
    if (!validUsername(username)) return json({ error: "用户名需要 2-24 位字母/数字/下划线/横线" }, 400);
    if (password.length < 6) return json({ error: "密码至少 6 位" }, 400);
    const key = `user:${username}`;
    if (await env.KV.get(key)) return json({ error: "这个用户名已经被用了" }, 409);
    const salt = crypto.randomUUID();
    const record: UserRecord = { salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
    await env.KV.put(key, JSON.stringify(record));
    const token = await createSession(env, username);
    return new Response(JSON.stringify({ user: username }), {
      headers: { "content-type": "application/json; charset=utf-8", "set-cookie": sessionCookie(token) },
    });
  }

  // ---- 登录 ----
  if (pathname === "/api/login" && method === "POST") {
    const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
    const username = (body?.username ?? "").trim();
    const password = body?.password ?? "";
    const raw = await env.KV.get(`user:${username}`);
    if (!raw) return json({ error: "用户名或密码不对" }, 401);
    const record = JSON.parse(raw) as UserRecord;
    if ((await hashPassword(password, record.salt)) !== record.hash) {
      return json({ error: "用户名或密码不对" }, 401);
    }
    const token = await createSession(env, username);
    return new Response(JSON.stringify({ user: username }), {
      headers: { "content-type": "application/json; charset=utf-8", "set-cookie": sessionCookie(token) },
    });
  }

  // ---- 登出 ----
  if (pathname === "/api/logout" && method === "POST") {
    const token = getCookie(req, COOKIE);
    if (token) await env.KV.delete(`session:${token}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json; charset=utf-8", "set-cookie": clearCookie() },
    });
  }

  // ---- 以下接口需要登录 ----
  const user = await sessionUser(env, req);

  if (pathname === "/api/me" && method === "GET") {
    return json({ user });
  }

  if (pathname === "/api/data" && method === "GET") {
    if (!user) return json({ error: "未登录" }, 401);
    const raw = await env.KV.get(`data:${user}`);
    return json({ data: raw ? JSON.parse(raw) : null });
  }

  if (pathname === "/api/data" && method === "PUT") {
    if (!user) return json({ error: "未登录" }, 401);
    const body = (await req.json().catch(() => null)) as { data?: unknown } | null;
    const data = body?.data as { version?: number; countries?: unknown } | undefined;
    if (!data || data.version !== 1 || typeof data.countries !== "object") {
      return json({ error: "数据格式不对" }, 400);
    }
    await env.KV.put(`data:${user}`, JSON.stringify(data));
    return json({ updatedAt: new Date().toISOString() });
  }

  return json({ error: "接口不存在" }, 404);
}
