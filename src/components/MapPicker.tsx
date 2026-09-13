import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { gcj02ToWgs84, toLeaflet, wgs84ToGcj02 } from "../lib/maps";

/** 高德只有国内道路数据（海外空白），海外换 Esri 全球街道图 */
const AMAP_TILE = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const ESRI_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

/** 点击地图选坐标的取点器，value 是 [经度, 纬度] */
export default function MapPicker({
  value,
  onChange,
  center,
}: {
  value?: [number, number] | null;
  onChange: (coords: [number, number]) => void;
  /** 无已存坐标时的初始视野中心（WGS84 [lng, lat]），通常是当前国家/城市 */
  center?: [number, number] | null;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** 当前底图是否为高德（决定存取坐标时的 GCJ-02 换算） */
  const activeAmapRef = useRef(true);
  /** 是否已按初始坐标居中过（只做一次） */
  const centeredRef = useRef(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    // 初始视野：已存坐标 > 指定中心（当前国家/城市） > 中国概览。
    // 高德道路瓦片 z2 及以下是空白图，最低从 z3 起用。
    const startPt = value ?? (center ?? undefined);
    const inChina = (c: [number, number]) => c[0] >= 72.004 && c[0] <= 137.8347 && c[1] >= 0.8293 && c[1] <= 55.8271;
    const startAmap = startPt ? inChina(startPt) : true;
    activeAmapRef.current = startAmap;
    const startShown = startPt ? (startAmap ? wgs84ToGcj02(startPt) : startPt) : ([108, 32] as [number, number]);
    const map = L.map(elRef.current, {
      center: toLeaflet(startShown),
      zoom: startPt ? 6 : 4,
      worldCopyJump: true,
    });
    const amap = L.tileLayer(AMAP_TILE, {
      subdomains: ["1", "2", "3", "4"],
      attribution: "&copy; 高德地图",
      maxZoom: 18,
    });
    const esri = L.tileLayer(ESRI_TILE, {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    });
    // 国内坐标默认高德底图（瓦片是 GCJ-02 网格），海外默认 Esri；右上角可切换
    (startAmap ? amap : esri).addTo(map);
    L.control.layers({ 高德地图: amap, 全球街道图: esri }, undefined, { position: "topright" }).addTo(map);
    map.on("baselayerchange", (e: L.LayersControlEvent) => {
      const toAmap = e.name === "高德地图";
      if (markerRef.current && toAmap !== activeAmapRef.current) {
        // 标记当前摆在旧网格上：先转回 WGS84，再摆到新网格
        const p = markerRef.current.getLatLng();
        const wgs = activeAmapRef.current ? gcj02ToWgs84([p.lng, p.lat]) : ([p.lng, p.lat] as [number, number]);
        const next = toAmap ? wgs84ToGcj02(wgs) : wgs;
        markerRef.current.setLatLng([next[1], next[0]]);
      }
      activeAmapRef.current = toAmap;
    });
    const store = (lng: number, lat: number) => {
      const [wlng, wlat] = activeAmapRef.current ? gcj02ToWgs84([lng, lat]) : [lng, lat];
      onChangeRef.current([+wlng.toFixed(6), +wlat.toFixed(6)]);
    };
    map.on("click", (e: L.LeafletMouseEvent) => store(e.latlng.lng, e.latlng.lat));
    // 弹窗有展开动画，容器尺寸就绪后要刷新一次，否则地图显示不全
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    mapRef.current = map;
    const t = window.setTimeout(() => map.invalidateSize(), 60);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      const shown = activeAmapRef.current ? wgs84ToGcj02(value) : value;
      const ll = toLeaflet(shown) as L.LatLngExpression;
      if (!centeredRef.current) {
        // 首次带入已有坐标：直接定位到它附近（只做一次，避免拖拽后又被拉回中心）
        map.setView(ll, activeAmapRef.current ? 12 : 11);
        centeredRef.current = true;
      } else if (!map.getBounds().contains(ll)) {
        map.setView(ll, Math.max(map.getZoom(), 5));
      }
      if (!markerRef.current) {
        const marker = L.marker(ll, { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          const [wlng, wlat] = activeAmapRef.current ? gcj02ToWgs84([p.lng, p.lat]) : [p.lng, p.lat];
          onChangeRef.current([+wlng.toFixed(6), +wlat.toFixed(6)]);
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(ll);
      }
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [value]);

  return <div ref={elRef} className="map-picker" aria-label="点击地图选取坐标" />;
}
