import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import countriesIso from "i18n-iso-countries";
import zhLocale from "i18n-iso-countries/langs/zh.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
countriesIso.registerLocale(zhLocale as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CountryFeature {
  /** world-atlas 里的 id 是 ISO 3166-1 数字码；个别地区是 -99 */
  id?: string | number;
  properties: { name?: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COUNTRY_FEATURES: CountryFeature[] = (feature(topology as any, (topology as any).objects.countries) as any)
  .features as CountryFeature[];

const numericToAlpha2Cache = new Map<string, string | null>();

/** 国家多边形 → ISO alpha-2 码（如 "FR"），识别不出来的返回 null */
export function alpha2Of(f: CountryFeature): string | null {
  const key = String(f.id ?? "");
  if (numericToAlpha2Cache.has(key)) return numericToAlpha2Cache.get(key)!;
  let result: string | null = null;
  try {
    const a2 = countriesIso.numericToAlpha2(key);
    result = a2 && countriesIso.isValid(a2) ? a2 : null;
  } catch {
    result = null;
  }
  numericToAlpha2Cache.set(key, result);
  return result;
}

/** 国家的中文名；中文库里没有时退回英文属性名 */
export function countryName(f: CountryFeature): string {
  const a2 = alpha2Of(f);
  const zh = a2 ? countriesIso.getName(a2, "zh") : "";
  return zh || f.properties?.name || a2 || "未知地区";
}

export function flagEmoji(alpha2: string): string {
  if (!/^[A-Za-z]{2}$/.test(alpha2)) return "🏳️";
  const base = 0x1f1e6;
  const up = alpha2.toUpperCase();
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}

/** 取要素里外包矩形面积最大的多边形（本土）的范围，忽略海外领地（如法属圭亚那） */
export function largestPolygonBounds(feature: GeoJSON.Feature): GeoJSON.Position[][] | null {
  const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  if (!geom) return null;
  const polygons: GeoJSON.Position[][][] =
    geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let best: GeoJSON.Position[] | null = null;
  let bestArea = -1;
  for (const poly of polygons) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let minLng = 180;
    let maxLng = -180;
    let minLat = 90;
    let maxLat = -90;
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    const area = (maxLng - minLng) * (maxLat - minLat);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best ? [best] : null;
}

/** 国家的中心点（本土最大多边形的外包矩形中心），WGS84 [lng, lat]；找不到返回 null */
export function countryCenter(alpha2: string): [number, number] | null {
  const feature = COUNTRY_FEATURES.find((f) => alpha2Of(f) === alpha2.toUpperCase());
  if (!feature) return null;
  const rings = largestPolygonBounds(feature as unknown as GeoJSON.Feature);
  if (!rings || !rings[0]) return null;
  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const [lng, lat] of rings[0]) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
