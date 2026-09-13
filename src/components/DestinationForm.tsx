import { useState } from "react";
import Modal from "./Modal";
import CoordsField from "./CoordsField";
import type { DestStatus } from "../types";

export interface DestinationInput {
  name: string;
  status: DestStatus;
  summary: string;
  coords: [number, number] | null;
}

export default function DestinationForm({
  title = "添加目的地",
  center,
  onSubmit,
  onClose,
}: {
  title?: string;
  /** 打开地图时的初始视野中心（WGS84 [lng, lat]），通常是当前国家/城市 */
  center?: [number, number] | null;
  onSubmit: (input: DestinationInput) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<DestStatus>("dream");
  const [summary, setSummary] = useState("");
  const [coords, setCoords] = useState<[number, number] | null>(null);

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit({ name, status, summary, coords });
        }}
      >
        <label className="field">
          名称
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：京都" required />
        </label>
        <fieldset className="field status-field">
          <legend>状态</legend>
          <label className="radio">
            <input type="radio" name="dest-status" checked={status === "dream"} onChange={() => setStatus("dream")} />
            <i className="dot dot-dream" aria-hidden="true" /> 想去
          </label>
          <label className="radio">
            <input type="radio" name="dest-status" checked={status === "visited"} onChange={() => setStatus("visited")} />
            <i className="dot dot-visited" aria-hidden="true" /> 去过
          </label>
        </fieldset>
        <label className="field">
          一句话介绍
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="为什么想去？最期待什么？"
          />
        </label>
        <div className="field">
          <span className="field-label">坐标（在地图上点一下，可不填）</span>
          <CoordsField value={coords} onChange={setCoords} center={center} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
