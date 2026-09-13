/** 坐标统一使用 [经度, 纬度]（lng, lat），与 GeoJSON 一致 */

export interface MapLink {
  name: string;
  url: string;
}

export function mapLinks(coords: [number, number]): MapLink[] {
  const [lng, lat] = coords;
  return [
    {
      name: "高德地图",
      // 站内坐标是 WGS84（GPS），必须带 coordinate=wgs84，否则在高德上会偏移几百米
      url: `https://uri.amap.com/marker?position=${lng},${lat}&coordinate=wgs84&callnative=0`,
    },
    {
      name: "百度地图",
      url: `https://api.map.baidu.com/geocoder?location=${lat},${lng}&coord_type=wgs84&output=html&src=our-travel-map`,
    },
    {
      name: "Google 地图",
      url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    },
  ];
}

export function formatCoords(coords: [number, number]): string {
  const [lng, lat] = coords;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** 是否在中国大陆范围内（决定用哪套底图和要不要做 GCJ-02 换算） */
export function inMainlandChina([lng, lat]: [number, number]): boolean {
  return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

/** Leaflet 用 [lat, lng] */
export function toLeaflet(coords: [number, number]): [number, number] {
  return [coords[1], coords[0]];
}

/* ---------- WGS84 ↔ GCJ-02（高德火星坐标） ---------- */

const GCJ_PI = Math.PI;
const GCJ_AXIS = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * GCJ_PI) + 20.0 * Math.sin(2.0 * x * GCJ_PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * GCJ_PI) + 40.0 * Math.sin((y / 3.0) * GCJ_PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * GCJ_PI) + 320 * Math.sin((y * GCJ_PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * GCJ_PI) + 20.0 * Math.sin(2.0 * x * GCJ_PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * GCJ_PI) + 40.0 * Math.sin((x / 3.0) * GCJ_PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * GCJ_PI) + 300.0 * Math.sin((x / 30.0) * GCJ_PI)) * 2.0) / 3.0;
  return ret;
}

/** WGS84（GPS）→ GCJ-02（高德）。中国大陆以外原样返回，海外点位不受影响 */
export function wgs84ToGcj02([lng, lat]: [number, number]): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * GCJ_PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_AXIS * (1 - GCJ_EE)) / (magic * sqrtMagic)) * GCJ_PI);
  dLng = (dLng * 180.0) / ((GCJ_AXIS / sqrtMagic) * Math.cos(radLat) * GCJ_PI);
  return [lng + dLng, lat + dLat];
}

/** GCJ-02 → WGS84，两次迭代近似逆变换，误差远小于选点精度 */
export function gcj02ToWgs84([lng, lat]: [number, number]): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let wlng = lng;
  let wlat = lat;
  for (let i = 0; i < 2; i++) {
    const [glng, glat] = wgs84ToGcj02([wlng, wlat]);
    wlng += lng - glng;
    wlat += lat - glat;
  }
  return [wlng, wlat];
}
