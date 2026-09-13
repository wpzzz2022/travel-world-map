import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DestinationForm from "../components/DestinationForm";
import { CN_CITIES, CN_PROVINCES } from "../data/china";
import { countryCenter } from "../lib/geo";
import { uid, useData } from "../lib/store";
import type { DestStatus } from "../types";

type CityStatus = DestStatus | "none";

const AMAP_TILE = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";

const STATUS_COLOR: Record<CityStatus, { fill: string; stroke: string; label: string }> = {
  visited: { fill: "#2e8b6a", stroke: "#ffffff", label: "去过" },
  dream: { fill: "#d99a2b", stroke: "#ffffff", label: "想去" },
  none: { fill: "#e3ecdf", stroke: "#8aa08c", label: "还没去" },
};

export default function ChinaPage() {
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | DestStatus | "none">("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const mapElRef = useRef<HTMLDivElement>(null);

  const dests = data.countries.CN?.destinations ?? [];
  const cityCodes = useMemo(() => new Set(CN_CITIES.map((c) => c.code)), []);
  const statusByCode = useMemo(() => {
    const m = new Map<string, CityStatus>();
    for (const d of dests) if (cityCodes.has(d.id)) m.set(d.id, d.status);
    return m;
  }, [dests, cityCodes]);
  const customDests = useMemo(() => dests.filter((d) => !cityCodes.has(d.id)), [dests, cityCodes]);

  const visited = CN_CITIES.filter((c) => statusByCode.get(c.code) === "visited").length;
  const dream = CN_CITIES.filter((c) => statusByCode.get(c.code) === "dream").length;

  // 地图：高德底图 + 省界 + 城市状态点（DataV 的中心点是 GCJ-02，和高德瓦片同网格，直接对齐）
  useEffect(() => {
    if (!mapElRef.current) return;
    const map = L.map(mapElRef.current, { scrollWheelZoom: false, attributionControl: false });
    // 鼠标悬停地图时才启用滚轮缩放：直接滚轮就能放大，移开地图恢复页面滚动
    map.on("mouseover", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());
    L.tileLayer(AMAP_TILE, { subdomains: ["1", "2", "3", "4"], maxZoom: 18 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("&copy; 高德地图 &copy; DataV.GeoAtlas").addTo(map);

    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}geo/china-provinces.json`)
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        L.geoJSON(geo, {
          style: { color: "#8aa08c", weight: 0.8, fillColor: "#ffffff", fillOpacity: 0.16 },
          interactive: false,
        }).addTo(map);
      })
      .catch(() => undefined);

    for (const city of CN_CITIES) {
      const status = statusByCode.get(city.code) ?? "none";
      const style = STATUS_COLOR[status];
      L.circleMarker([city.center[1], city.center[0]], {
        radius: status === "none" ? 4 : 6,
        color: style.stroke,
        weight: 1.5,
        fillColor: style.fill,
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindTooltip(`<b>${city.name}</b> · ${style.label}`, { direction: "top", offset: [0, -4] })
        .on("click", () => navigate(`/country/CN/dest/${city.code}`));
    }

    map.fitBounds([
      [17.5, 73.5],
      [53.8, 135.2],
    ]);
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCustom = (input: { name: string; status: DestStatus; summary: string; coords: [number, number] | null }) => {
    mutate((d) => {
      const entry = d.countries.CN ?? (d.countries.CN = { destinations: [] });
      entry.destinations.push({
        id: uid(),
        name: input.name.trim(),
        status: input.status,
        summary: input.summary.trim() || undefined,
        coords: input.coords ?? undefined,
        spots: [],
      });
    });
    setAdding(false);
  };

  const provinces = CN_PROVINCES.map((province) => ({
    province,
    cities: CN_CITIES.filter((c) => c.province === province),
  })).filter(({ cities }) =>
    cities.some((c) => {
      const s = statusByCode.get(c.code) ?? "none";
      if (filter !== "all" && s !== filter) return false;
      if (search && !c.name.includes(search.trim()) && !c.province.includes(search.trim())) return false;
      return true;
    }),
  );

  return (
    <div className="page page-wide">
      <nav className="crumb">
        <Link to="/">🌍</Link>
        <span aria-hidden="true">/</span>
        <b>🇨🇳 中国</b>
      </nav>

      <header className="page-head">
        <div>
          <h1 className="display page-title">中国</h1>
          <p className="page-meta">
            {CN_CITIES.length} 个城市 · <i className="dot dot-visited" aria-hidden="true" /> 去过 {visited} ·{" "}
            <i className="dot dot-dream" aria-hidden="true" /> 想去 {dream} · 其余还没去
          </p>
        </div>
        <div className="page-side">
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            ＋ 自定义地点
          </button>
        </div>
      </header>

      <section className="section section-first">
        <div className="map-shell china-map" ref={mapElRef} />
        <div className="map-legend china-legend">
          {(Object.keys(STATUS_COLOR) as CityStatus[]).map((s) => (
            <span key={s}>
              <i className="china-dot" style={{ background: STATUS_COLOR[s].fill, borderColor: STATUS_COLOR[s].stroke }} />
              {STATUS_COLOR[s].label}
            </span>
          ))}
          <span className="map-legend-coords">悬停后滚轮缩放 · 点城市看景点</span>
        </div>
      </section>

      {customDests.length > 0 && (
        <section className="section">
          <h2 className="display section-title">自定义地点</h2>
          <ul className="rows">
            {customDests.map((d) => (
              <li
                key={d.id}
                className="row"
                onClick={() => navigate(`/country/CN/dest/${d.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/country/CN/dest/${d.id}`)}
                role="link"
                tabIndex={0}
              >
                <div className="row-main">
                  <h2 className="display row-title">{d.name}</h2>
                  <p className="row-meta">
                    <i className={`dot dot-${d.status}`} aria-hidden="true" />
                    {d.status === "visited" ? "去过" : "想去"} · {d.spots.length} 个景点
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2 className="display section-title">城市</h2>
        <div className="china-filter">
          {(
            [
              ["all", `全部 ${CN_CITIES.length}`],
              ["visited", `去过 ${visited}`],
              ["dream", `想去 ${dream}`],
              ["none", `还没去 ${CN_CITIES.length - visited - dream}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip ${filter === key ? "chip-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
          <input
            className="china-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜城市名…"
            aria-label="搜索城市"
          />
        </div>

        {provinces.length === 0 ? (
          <p className="empty">没有符合条件的城市。</p>
        ) : (
          provinces.map(({ province, cities }) => (
            <div key={province} className="china-province">
              <h3 className="display china-province-name">{province.replace(/(省|市|自治区|特别行政区)$/, "")}</h3>
              <div className="china-cities">
                {cities.map((c) => {
                  const s = (statusByCode.get(c.code) ?? "none") as CityStatus;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className="china-city"
                      title={`${c.name} · ${STATUS_COLOR[s].label}`}
                      onClick={() => navigate(`/country/CN/dest/${c.code}`)}
                    >
                      <i
                        className="china-dot"
                        style={{ background: STATUS_COLOR[s].fill, borderColor: STATUS_COLOR[s].stroke }}
                        aria-hidden="true"
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {adding && (
        <DestinationForm
          title="添加自定义地点"
          center={countryCenter("CN")}
          onSubmit={submitCustom}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
