import { createContext, useContext } from "react";
import seed from "../data/seed.json";
import type { TravelData } from "../types";

const STORAGE_KEY = "our-travel-map:v1";

export function loadData(): TravelData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TravelData;
      if (parsed && parsed.version === 1 && parsed.countries) {
        return { trips: [], adventures: [], ...parsed };
      }
    }
  } catch {
    /* 数据损坏时回退到示例数据 */
  }
  return structuredClone(seed) as unknown as TravelData;
}

export function saveData(data: TravelData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearData() {
  localStorage.removeItem(STORAGE_KEY);
}

export interface DataContextValue {
  data: TravelData;
  /** 以当前数据为基准做一次修改并持久化 */
  mutate: (fn: (draft: TravelData) => void) => void;
  /** 整体替换数据（导入 / 重置用） */
  replaceData: (data: TravelData) => void;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData 必须在 DataContext 内使用");
  return ctx;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function exportJson(data: TravelData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `our-travel-map-${day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImported(text: string): TravelData {
  const parsed = JSON.parse(text) as TravelData;
  if (!parsed || parsed.version !== 1 || typeof parsed.countries !== "object") {
    throw new Error("文件格式不对：需要本站导出的 JSON（version: 1）");
  }
  return { trips: [], adventures: [], ...parsed };
}
