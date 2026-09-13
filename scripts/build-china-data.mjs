/**
 * 从 DataV.GeoAtlas 抓取中国行政区划 GeoJSON，生成本项目需要的两份数据：
 *  1. public/geo/china-provinces.json —— 省级边界（底图轮廓，坐标保留 3 位小数）
 *  2. src/data/china-cities.json     —— 市级清单（名称、adcode、所属省、中心点坐标）
 *
 * 直辖市（京津沪渝）和港澳台没有"地级市"层级，市级就取省本身。
 * 用法：node scripts/build-china-data.mjs
 */

const BASE = "https://geo.datav.aliyun.com/areas_v3/bound";
const MUNICIPALITIES = new Set(["110000", "120000", "310000", "500000", "710000", "810000", "820000"]);

const round3 = (n) => Math.round(n * 1000) / 1000;

function roundCoords(coords) {
  if (typeof coords[0] === "number") return [round3(coords[0]), round3(coords[1])];
  return coords.map(roundCoords);
}

function stripFeature(feature) {
  return {
    type: "Feature",
    properties: { adcode: String(feature.properties.adcode), name: feature.properties.name },
    geometry: { type: feature.geometry.type, coordinates: roundCoords(feature.geometry.coordinates) },
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const national = await fetchJson(`${BASE}/100000_full.json`);
const provinces = national.features
  .filter((f) => String(f.properties.adcode) !== "100000")
  .map(stripFeature);
console.log(`省级要素：${provinces.length}`);

const cities = [];
for (const f of national.features) {
  const adcode = String(f.properties.adcode);
  if (adcode === "100000") continue;
  const provinceName = f.properties.name;
  if (MUNICIPALITIES.has(adcode)) {
    // 直辖市/港澳台：省级即市级
    cities.push({
      code: adcode,
      name: provinceName.replace(/(省|市|自治区|特别行政区|维吾尔|回族|壮族)/g, "") || provinceName,
      province: provinceName,
      center: f.properties.center || f.properties.centroid,
    });
    continue;
  }
  try {
    const prov = await fetchJson(`${BASE}/${adcode}_full.json`);
    for (const c of prov.features) {
      if (String(c.properties.adcode) === adcode) continue; // 跳过省级自身
      const center = c.properties.center || c.properties.centroid;
      if (!center) continue;
      cities.push({ code: String(c.properties.adcode), name: c.properties.name, province: provinceName, center });
    }
    console.log(`${provinceName}: ${prov.features.length - 1} 个市`);
  } catch (e) {
    console.warn(`跳过 ${provinceName}(${adcode}): ${e.message}`);
  }
}

const fs = await import("node:fs");
fs.mkdirSync("public/geo", { recursive: true });
fs.writeFileSync("public/geo/china-provinces.json", JSON.stringify({ type: "FeatureCollection", features: provinces }));
fs.writeFileSync("src/data/china-cities.json", JSON.stringify(cities));
console.log(`共 ${cities.length} 个市级单位 → src/data/china-cities.json`);
console.log(`省界 → public/geo/china-provinces.json (${(fs.statSync("public/geo/china-provinces.json").size / 1024).toFixed(0)} KB)`);
