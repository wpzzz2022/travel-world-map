import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DestinationForm from "../components/DestinationForm";
import { alpha2Of, countryCenter, countryName, COUNTRY_FEATURES, flagEmoji, largestPolygonBounds } from "../lib/geo";
import { uid, useData } from "../lib/store";
import type { DestStatus } from "../types";

const ESRI_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export default function CountryPage() {
  const { code = "" } = useParams();
  const upper = code.toUpperCase();
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const feature = useMemo(() => COUNTRY_FEATURES.find((f) => alpha2Of(f) === upper), [upper]);
  const name = feature ? countryName(feature) : upper;
  const dests = data.countries[upper]?.destinations ?? [];

  // 国家地图：国家轮廓高亮 + 已记录目的地标记（海外坐标是 WGS84，配 Esri 瓦片直接对齐）
  const mapElRef = useRef<HTMLDivElement>(null);
  const markedDests = useMemo(() => dests.filter((d) => d.coords), [dests]);
  const markerKey = JSON.stringify(markedDests.map((d) => [d.id, d.status, d.coords]));

  useEffect(() => {
    if (!mapElRef.current) return;
    const map = L.map(mapElRef.current, { scrollWheelZoom: false, attributionControl: false });
    map.on("mouseover", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());
    L.tileLayer(ESRI_TILE, { maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("Tiles &copy; Esri").addTo(map);

    if (feature) {
      L.geoJSON(feature as unknown as GeoJSON.Feature, {
        style: { color: "#2e8b6a", weight: 1.5, fillColor: "#2e8b6a", fillOpacity: 0.08 },
        interactive: false,
      }).addTo(map);
      try {
        // 有些国家（如法国）在数据里带海外领地，直接 fitBounds 会变成全世界视图；
        // 取面积最大的那块多边形（通常即本土）来定位
        const rings = largestPolygonBounds(feature as unknown as GeoJSON.Feature);
        if (rings) {
          const b = L.latLngBounds(rings[0].map(([lng, lat]) => [lat, lng] as [number, number]));
          map.fitBounds(b, { padding: [26, 26] });
        }
      } catch {
        map.setView([20, 0], 2);
      }
    } else {
      map.setView([25, 10], 2);
    }

    for (const d of markedDests) {
      L.circleMarker([d.coords![1], d.coords![0]], {
        radius: 7,
        color: "#ffffff",
        weight: 1.5,
        fillColor: d.status === "visited" ? "#2e8b6a" : "#d99a2b",
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindTooltip(`<b>${d.name}</b> · ${d.status === "visited" ? "去过" : "想去"}`, { direction: "top", offset: [0, -4] })
        .on("click", () => navigate(`/country/${upper}/dest/${d.id}`));
    }

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapElRef.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upper, feature, markerKey]);

  const submit = (input: { name: string; status: DestStatus; summary: string; coords: [number, number] | null }) => {
    mutate((d) => {
      const entry = d.countries[upper] ?? (d.countries[upper] = { destinations: [] });
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

  const remove = (id: string, destName: string) => {
    if (!window.confirm(`删除目的地「${destName}」？里面的景点、打卡点和笔记也会一起删掉。`)) return;
    mutate((d) => {
      const entry = d.countries[upper];
      if (!entry) return;
      entry.destinations = entry.destinations.filter((x) => x.id !== id);
      if (entry.destinations.length === 0) delete d.countries[upper];
    });
  };
  return (
    <div className="page">
      <nav className="crumb">
        <Link to="/">🌍 我们的旅行地图</Link>
        <span aria-hidden="true">/</span>
        <b>{name}</b>
      </nav>

      <header className="page-head">
        <h1 className="display page-title">
          <span className="flag" aria-hidden="true">
            {flagEmoji(upper)}
          </span>
          {name}
        </h1>
        <div className="page-side">
          <p className="page-meta">{dests.length === 0 ? "还没有目的地" : `${dests.length} 个目的地`}</p>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            ＋ 添加目的地
          </button>
        </div>
      </header>

      <section className="section section-first">
        <div className="map-shell country-map" ref={mapElRef} />
        <div className="map-legend china-legend">
          <span>
            <i className="china-dot" style={{ background: "#2e8b6a", borderColor: "#fff" }} /> 去过
          </span>
          <span>
            <i className="china-dot" style={{ background: "#d99a2b", borderColor: "#fff" }} /> 想去
          </span>
          <span className="map-legend-coords">悬停后滚轮缩放 · 点标记看景点</span>
        </div>
      </section>

      {dests.length === 0 ? (
        <div className="empty">
          <p>把想去的城市放进来：先加一个目的地，再往里面填景点、打卡点和小红书笔记。</p>
        </div>
      ) : (
        <ul className="rows">
          {dests.map((d) => (
            <li
              key={d.id}
              className="row"
              onClick={() => navigate(`/country/${upper}/dest/${d.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/country/${upper}/dest/${d.id}`);
              }}
              role="link"
              tabIndex={0}
            >
              <div className="row-main">
                <h2 className="display row-title">{d.name}</h2>
                {d.summary && <p className="row-desc">{d.summary}</p>}
                <p className="row-meta">
                  <i className={`dot dot-${d.status}`} aria-hidden="true" />
                  {d.status === "visited" ? "去过" : "想去"}
                  <span> · {d.spots.length} 个景点</span>
                  {d.coords && <span> · 已标坐标</span>}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn row-remove"
                aria-label={`删除目的地 ${d.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(d.id, d.name);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <DestinationForm
          onSubmit={submit}
          onClose={() => setAdding(false)}
          center={countryCenter(upper)}
        />
      )}
    </div>
  );
}
