/**
 * 旅行地图 · 自托管同步后端（零依赖，node:20-alpine 可直接跑）
 *
 * 接口与 api/src/worker.ts（Cloudflare Worker 版）完全一致，前端零改动：
 *   POST /api/register  { username, password, code }   注册（需要 REGISTER_CODE）
 *   POST /api/login     { username, password }         登录，种 30 天会话 Cookie
 *   POST /api/logout                                   注销会话
 *   GET  /api/me                                       当前用户
 *   GET  /api/data                                     读自己账号的 TravelData JSON
 *   PUT  /api/data      { data }                       写自己账号的 TravelData JSON
 *
 * 存储：/data/travel-db.json（挂 Docker volume）。密码 PBKDF2-SHA256 + 随机盐。
 * 环境变量：REGISTER_CODE（注册邀请码，不设则注册关闭）、DATA_DIR、PORT。
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 8788);
const DATA_DIR = process.env.DATA_DIR || "/data";
const DB_FILE = path.join(DATA_DIR, "travel-db.json");
const REGISTER_CODE = process.env.REGISTER_CODE || "";
const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 天
const COOKIE = "sid";

// ---------- 存储 ----------

let db = loadDb();
let saveTimer = null;

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: {}, data: {}, sessions: {} };
  }
}

function saveDb() {
  // 合并多次写入 + 原子替换，避免写一半断电
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.error("save db failed:", e);
    }
  }, 50);
}

// 会话惰性清理：每次启动清一次过期令牌
for (const [token, s] of Object.entries(db.sessions || {})) {
  if (!s || s.expiresAt < Date.now()) delete db.sessions[token];
}

// ---------- 工具 ----------

const json = (res, data, status = 200, extraHeaders = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(data));
};

function getCookie(req, name) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const validUsername = (u) => /^[A-Za-z0-9_-]{2,24}$/.test(u);

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
}

function createSession(req, username) {
  const token = crypto.randomUUID() + "." + crypto.randomUUID().slice(0, 8);
  const expiresAt = Date.now() + SESSION_TTL;
  db.sessions[token] = { user: username, expiresAt };
  saveDb();
  // 本地 http 部署时不能带 Secure（浏览器会拒收），https 反代时自动带上
  const https = new URL(req.url, `http://${req.headers.host || "localhost"}`).protocol === "https:" ||
    req.headers["x-forwarded-proto"] === "https";
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; ${https ? "Secure;" : ""} SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`;
}

function sessionUser(req) {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const s = db.sessions[token];
  if (!s || s.expiresAt < Date.now()) {
    delete db.sessions[token];
    saveDb();
    return null;
  }
  return s.user;
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

// ---------- 路由 ----------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (!url.pathname.startsWith("/api/")) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "接口不存在" }));
  }
  const method = req.method;
  const p = url.pathname;

  if (p === "/api/register" && method === "POST") {
    const body = (await readBody(req)) ?? {};
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    if (!REGISTER_CODE) return json(res, { error: "注册未开放：管理员未设置 REGISTER_CODE" }, 403);
    if (body.code !== REGISTER_CODE) return json(res, { error: "邀请码不对" }, 403);
    if (!validUsername(username)) return json(res, { error: "用户名需要 2-24 位字母/数字/下划线/横线" }, 400);
    if (password.length < 6) return json(res, { error: "密码至少 6 位" }, 400);
    if (db.users[username]) return json(res, { error: "这个用户名已经被用了" }, 409);
    const salt = crypto.randomUUID();
    db.users[username] = { salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() };
    saveDb();
    const cookie = createSession(req, username);
    return json(res, { user: username }, 200, { "set-cookie": cookie });
  }

  if (p === "/api/login" && method === "POST") {
    const body = (await readBody(req)) ?? {};
    const username = (body.username ?? "").trim();
    const record = db.users[username];
    if (!record || record.hash !== hashPassword(body.password ?? "", record.salt)) {
      return json(res, { error: "用户名或密码不对" }, 401);
    }
    const cookie = createSession(req, username);
    return json(res, { user: username }, 200, { "set-cookie": cookie });
  }

  if (p === "/api/logout" && method === "POST") {
    const token = getCookie(req, COOKIE);
    if (token) {
      delete db.sessions[token];
      saveDb();
    }
    return json(res, { ok: true }, 200, { "set-cookie": `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  }

  const user = sessionUser(req);

  if (p === "/api/me" && method === "GET") return json(res, { user });

  if (p === "/api/data" && method === "GET") {
    if (!user) return json(res, { error: "未登录" }, 401);
    return json(res, { data: db.data[user] ?? null });
  }

  if (p === "/api/data" && method === "PUT") {
    if (!user) return json(res, { error: "未登录" }, 401);
    const body = (await readBody(req)) ?? {};
    const data = body.data;
    if (!data || data.version !== 1 || typeof data.countries !== "object") {
      return json(res, { error: "数据格式不对" }, 400);
    }
    db.data[user] = data;
    saveDb();
    return json(res, { updatedAt: new Date().toISOString() });
  }

  return json(res, { error: "接口不存在" }, 404);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, { error: "服务器内部错误" }, 500);
  });
});

server.listen(PORT, () => console.log(`travel-map api listening on :${PORT}`));
