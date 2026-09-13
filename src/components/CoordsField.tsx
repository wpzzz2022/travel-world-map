import MapPicker from "./MapPicker";
import { formatCoords } from "../lib/maps";

/** 表单里的坐标字段：地图点选 + 手动输入经纬度，可留空 */
export default function CoordsField({
  value,
  onChange,
  center,
}: {
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  /** 打开地图时的初始视野中心（WGS84 [lng, lat]） */
  center?: [number, number] | null;
}) {
  const setLng = (raw: string) => {
    const lng = parseFloat(raw);
    if (!Number.isFinite(lng)) return;
    onChange(value ? [lng, value[1]] : [lng, 0]);
  };
  const setLat = (raw: string) => {
    const lat = parseFloat(raw);
    if (!Number.isFinite(lat)) return;
    onChange(value ? [value[0], lat] : [0, lat]);
  };

  return (
    <div className="coords-field">
      <MapPicker value={value} onChange={onChange} center={center} />
      <div className="coords-row">
        <label>
          经度
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={value ? String(value[0]) : ""}
            placeholder="139.69"
            onChange={(e) => setLng(e.target.value)}
          />
        </label>
        <label>
          纬度
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={value ? String(value[1]) : ""}
            placeholder="35.68"
            onChange={(e) => setLat(e.target.value)}
          />
        </label>
        <button type="button" className="btn" onClick={() => onChange(null)} disabled={!value}>
          清除坐标
        </button>
      </div>
      {value && <p className="form-tip">当前坐标：{formatCoords(value)}（页面上的「打开地图」会用到）</p>}
    </div>
  );
}
