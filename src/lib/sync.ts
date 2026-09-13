import type { TravelData } from "../types";

/** /api/* 的客户端封装。同源部署（Worker 同时托管静态站和 API），Cookie 自动携带。 */

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, init);
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null; // 开发模式没有 Worker，返回的是 index.html
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface MeResult {
  user: string | null;
  /** 后端不可达（本地 npm run dev 没开 Worker） */
  unavailable: boolean;
}

export async function apiMe(): Promise<MeResult> {
  const j = await jsonFetch<{ user: string | null }>("/api/me");
  if (j === null) return { user: null, unavailable: true };
  return { user: j.user ?? null, unavailable: false };
}

async function post<T>(url: string, body?: unknown): Promise<{ ok: boolean; error?: string; data?: T }> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: j } : { ok: false, error: j?.error ?? `失败（${r.status}）` };
  } catch {
    return { ok: false, error: "网络错误，稍后再试" };
  }
}

export const apiRegister = (username: string, password: string, code: string) =>
  post<{ user: string }>("/api/register", { username, password, code });

export const apiLogin = (username: string, password: string) => post<{ user: string }>("/api/login", { username, password });

export const apiLogout = () => post("/api/logout");

/** 服务器上的数据：null = 该账号还没有同步过 */
export async function apiGetData(): Promise<TravelData | null | "unavailable"> {
  const j = await jsonFetch<{ data: TravelData | null }>("/api/data");
  if (j === null) return "unavailable";
  return j.data ?? null;
}

export async function apiPutData(data: TravelData): Promise<boolean> {
  try {
    const r = await fetch("/api/data", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
