import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { COUNTRY_FEATURES, alpha2Of, countryName } from "../lib/geo";
import type { CountryFeature } from "../lib/geo";
import { useData } from "../lib/store";

const BASE_CAP = "rgba(168, 200, 172, 0.95)";
const DREAM_CAP = "rgba(222, 158, 48, 0.95)";
const VISITED_CAP = "rgba(46, 139, 106, 0.95)";
const HOVER_CAP = "#8fd0ae";
const SIDE_COLOR = "rgba(110, 145, 118, 0.55)";
const STROKE_COLOR = "rgba(255, 255, 255, 0.65)";

export default function HomePage() {
  const { data } = useData();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  const [hovered, setHovered] = useState<CountryFeature | null>(null);

  const { countryCount, destCount, spotCount, statusOf, hasData } = useMemo(() => {
    const statusOf = new Map<string, boolean>(); // alpha2 -> 是否全部去过（有任一去过就算去过）
    let destCount = 0;
    let spotCount = 0;
    for (const [alpha2, entry] of Object.entries(data.countries)) {
      const visited = entry.destinations.some((d) => d.status === "visited");
      statusOf.set(alpha2.toUpperCase(), visited);
      destCount += entry.destinations.length;
      for (const dest of entry.destinations) spotCount += dest.spots.length;
    }
    return {
      countryCount: Object.keys(data.countries).length,
      destCount,
      spotCount,
      statusOf,
      hasData: (f: CountryFeature) => {
        const a2 = alpha2Of(f);
        return a2 ? statusOf.has(a2.toUpperCase()) : false;
      },
    };
  }, [data]);

  const rings = useMemo(() => {
    const out: { name: string; coords: [number, number]; visited: boolean }[] = [];
    for (const entry of Object.values(data.countries)) {
      for (const dest of entry.destinations) {
        if (dest.coords) out.push({ name: dest.name, coords: dest.coords, visited: dest.status === "visited" });
      }
    }
    return out;
  }, [data]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#a9cdea"),
        emissive: new THREE.Color("#8bb8dd"),
        shininess: 4,
      }),
    [],
  );

  const onGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__globe = g;
    const controls = g.controls();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.55;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
      });
    }
    controls.minDistance = 170;
    controls.maxDistance = 620;
    g.pointOfView({ lat: 24, lng: 108, altitude: 2.35 }, 0);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capColor = (f: any) => {
    if (f === hovered) return HOVER_CAP;
    const a2 = alpha2Of(f as CountryFeature);
    if (a2 && statusOf.get(a2.toUpperCase())) return VISITED_CAP;
    if (a2 && statusOf.has(a2.toUpperCase())) return DREAM_CAP;
    return BASE_CAP;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const altitude = (f: any) => {
    const base = hasData(f) ? 0.014 : 0.006;
    return f === hovered ? base + 0.02 : base;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const label = (f: any) => {
    const feat = f as CountryFeature;
    const a2 = alpha2Of(feat);
    const name = countryName(feat);
    const dests = a2 ? data.countries[a2.toUpperCase()]?.destinations.length ?? 0 : 0;
    if (!a2) return `<div class="globe-tip"><b>${name}</b></div>`;
    return (
      `<div class="globe-tip"><b>${name}</b>` +
      `<span>${dests > 0 ? `${dests} 个目的地 · 点开看看` : "还没有目的地 · 点击添加"}</span></div>`
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickCountry = (f: any) => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__lastClick = {
        keys: f ? Object.keys(f).slice(0, 8) : null,
        id: f?.id ?? null,
        props: f?.properties ?? null,
      };
    }
    const a2 = alpha2Of(f as CountryFeature);
    if (a2) navigate(`/country/${a2}`);
  };

  return (
    <div className="home">
      <div className="home-hero">
        <h1 className="display home-title">我们的旅行地图</h1>
        <p className="home-sub">把想去的地方，一颗一颗点亮。</p>
        <p className="home-stats" aria-live="polite">
          {destCount > 0
            ? `点亮了 ${countryCount} 个国家，攒下 ${destCount} 个目的地、${spotCount} 个景点。`
            : "地球上还是黑的，先点开一个国家，把想去的地方放进来。"}
        </p>
        <p className="home-legend">
          <i className="dot dot-dream" aria-hidden="true" /> 想去
          <i className="dot dot-visited" aria-hidden="true" /> 去过
        </p>
        <p className="home-hint">拖动旋转 · 滚轮缩放 · 点击亮色的国家</p>
      </div>

      <div className="home-globe" ref={wrapRef}>
        <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showGraticules={false}
        showAtmosphere
        atmosphereColor="#8fbede"
        atmosphereAltitude={0.13}
        polygonsData={COUNTRY_FEATURES}
        polygonCapColor={capColor}
        polygonSideColor={() => SIDE_COLOR}
        polygonStrokeColor={() => STROKE_COLOR}
        polygonAltitude={altitude}
        polygonLabel={label}
        onPolygonHover={(f) => setHovered(f as CountryFeature | null)}
        onPolygonClick={clickCountry}
        polygonsTransitionDuration={280}
        ringsData={rings}
        ringColor={
          ((d: { visited: boolean }) => (t: number) =>
            d.visited ? `rgba(46, 139, 106, ${1 - t})` : `rgba(217, 154, 43, ${1 - t})`) as never
        }
        ringMaxRadius={2.6}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={1100}
        onGlobeReady={onGlobeReady}
        />
      </div>
    </div>
  );
}
