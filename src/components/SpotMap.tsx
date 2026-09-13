import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Spot } from "../types";
import { formatCoords, inMainlandChina, toLeaflet, wgs84ToGcj02 } from "../lib/maps";

/** 底图瓦片：高德只有国内道路数据（海外是空白图），海外换 Esri 全球街道图 */
const AMAP_TILE = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const ESRI_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

function popupHtml(title: string, desc: string | undefined, photos: { url: string; caption?: string }[]) {
  // 弹窗缩略图用 <img>，视频跳过
  const images = photos.filter((p) => !/\.(mp4|m4v|webm|mov|avi|mkv)(\?.*)?$/i.test(p.url));
  const img = images[0] ? `<img src="${images[0].url}" alt="">` : "";
  return (
    `<div class="map-popup"><b>${title}</b>` +
    img +
    (desc ? `<p>${desc}</p>` : "") +
    (images[0]?.caption ? `<i>${images[0].caption}</i>` : "") +
    `</div>`
  );
}

const spotIcon = L.divIcon({
  className: "map-icon map-icon-spot",
  html: '<span class="pin-spot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

function checkinIcon(n: number) {
  return L.divIcon({
    className: "map-icon map-icon-checkin",
    html: `<span class="pin-checkin">${n}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

/** 景点概览图：金色菱形是景点本体，绿色数字是各打卡点 */
export default function SpotMap({ spot }: { spot: Spot }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { scrollWheelZoom: false });
    // 国内点位用高德（GCJ-02 网格，标记要换算），海外用 Esri（WGS84，直接用）
    const anchor = spot.coords ?? spot.checkins.find((c) => c.coords)?.coords;
    const useAmap = !!anchor && inMainlandChina(anchor);
    const toMap = (c: [number, number]): [number, number] => (useAmap ? wgs84ToGcj02(c) : c);
    if (useAmap) {
      L.tileLayer(AMAP_TILE, {
        subdomains: ["1", "2", "3", "4"],
        attribution: "&copy; 高德地图",
        maxZoom: 18,
      }).addTo(map);
    } else {
      L.tileLayer(ESRI_TILE, {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
      }).addTo(map);
    }
    // 悬停地图时启用滚轮缩放（比"点一下才启用"更好发现），移开恢复页面滚动
    map.on("mouseover", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());
    mapRef.current = map;

    const points: L.LatLngExpression[] = [];
    if (spot.coords) {
      L.marker(toLeaflet(toMap(spot.coords)), { icon: spotIcon })
        .addTo(map)
        .bindPopup(
          popupHtml(spot.name, spot.description ? spot.description.slice(0, 60) + "…" : undefined, spot.photos),
        );
      points.push(toLeaflet(toMap(spot.coords)));
    }
    spot.checkins.forEach((ck, i) => {
      if (!ck.coords) return;
      L.marker(toLeaflet(toMap(ck.coords)), { icon: checkinIcon(i + 1) })
        .addTo(map)
        .bindPopup(popupHtml(ck.name, ck.description, ck.photos));
      points.push(toLeaflet(toMap(ck.coords)));
    });

    if (points.length === 1) {
      map.setView(points[0], 15);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.25));
    } else {
      map.setView([30, 110], 2);
    }
    const t = window.setTimeout(() => map.invalidateSize(), 60);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [spot]);

  if (!spot.coords && spot.checkins.every((c) => !c.coords)) {
    return (
      <div className="map-empty">
        还没有标注坐标：编辑景点或打卡点时，在地图上点一下就能放上去。
      </div>
    );
  }

  return (
    <div className="map-shell">
      <div ref={elRef} className="map-canvas" />
      <div className="map-legend">
        <span>
          <i className="pin-spot legend-pin" /> 景点
        </span>
        <span>
          <i className="pin-checkin legend-pin">1</i> 打卡点
        </span>
        {spot.coords && <span className="map-legend-coords">{formatCoords(spot.coords)}</span>}
      </div>
    </div>
  );
}
