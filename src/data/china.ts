import rawCities from "./china-cities.json";
import { gcj02ToWgs84 } from "../lib/maps";

export interface ChinaCity {
  /** 行政区划码（DataV adcode），同时作为目的地的稳定 id */
  code: string;
  name: string;
  province: string;
  /** DataV 的中心点是 GCJ-02，展示在高德底图上直接可用 */
  center: [number, number];
  /** 换算回 WGS84 的中心点，入库/外链用 */
  wgsCenter: [number, number];
}

/** 地级市清单（直辖市/港澳台 = 省级本身），370 个 */
export const CN_CITIES: ChinaCity[] = (rawCities as Array<Omit<ChinaCity, "wgsCenter">>).map((c) => ({
  ...c,
  wgsCenter: gcj02ToWgs84(c.center),
}));

const byCode = new Map(CN_CITIES.map((c) => [c.code, c]));

export function cnCityByCode(code: string): ChinaCity | undefined {
  return byCode.get(code);
}

export const CN_PROVINCES = [...new Set(CN_CITIES.map((c) => c.province))];
