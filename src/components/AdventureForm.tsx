import { useState } from "react";
import Modal from "./Modal";
import { useData } from "../lib/store";
import type { Adventure } from "../types";

export interface AdventureInput {
  title: string;
  country?: string;
  destId?: string;
  dateStart?: string;
  dateEnd?: string;
  rating?: number;
  note?: string;
}

/** 新建/编辑冒险记录：日期、关联去过的目的地、评分、感想 */
export default function AdventureForm({
  initial,
  presetDest,
  onSubmit,
  onClose,
}: {
  initial?: Partial<Adventure>;
  /** 预选的目的地（城市页创建时带上） */
  presetDest?: { country: string; destId: string; name: string };
  onSubmit: (input: AdventureInput) => void;
  onClose: () => void;
}) {
  const { data } = useData();
  const visited = Object.entries(data.countries).flatMap(([code, entry]) =>
    entry.destinations.filter((d) => d.status === "visited").map((d) => ({ code, dest: d })),
  );

  const [title, setTitle] = useState(initial?.title ?? presetDest?.name ?? "");
  const [destKey, setDestKey] = useState(
    initial?.destId && initial?.country ? `${initial.country}|${initial.destId}` : presetDest ? `${presetDest.country}|${presetDest.destId}` : "",
  );
  const [dateStart, setDateStart] = useState(initial?.dateStart ?? "");
  const [dateEnd, setDateEnd] = useState(initial?.dateEnd ?? "");
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  const submit = () => {
    const [country, destId] = destKey ? destKey.split("|") : [undefined, undefined];
    onSubmit({
      title: title.trim() || presetDest?.name || "未命名冒险",
      country,
      destId,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      rating: rating > 0 ? rating : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal title={initial?.id ? "编辑冒险记录" : "新建冒险记录"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          冒险名称
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={presetDest ? `例如：${presetDest.name}五日` : "例如：东京·第一次一起出国"}
            required
          />
        </label>
        <label className="field">
          关联去过的地点（可选）
          <select value={destKey} onChange={(e) => setDestKey(e.target.value)}>
            <option value="">不关联</option>
            {visited.map(({ code, dest }) => (
              <option key={`${code}-${dest.id}`} value={`${code}|${dest.id}`}>
                {dest.name}
              </option>
            ))}
            {presetDest && !visited.some(({ dest }) => dest.id === presetDest.destId) && (
              <option value={`${presetDest.country}|${presetDest.destId}`}>{presetDest.name}</option>
            )}
          </select>
        </label>
        <div className="field-grid">
          <label className="field">
            开始日期
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </label>
          <label className="field">
            结束日期（可选）
            <input type="date" value={dateEnd} min={dateStart || undefined} onChange={(e) => setDateEnd(e.target.value)} />
          </label>
        </div>
        <label className="field">
          评分（可选）
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            <option value={0}>未评分</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}{"☆".repeat(5 - n)}（{n} 星）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          感想（可选）
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="这趟最难忘的瞬间、下次想补的遗憾……"
          />
        </label>
        <p className="form-tip">相册在保存后的详情页里：可以关联本机照片文件夹，也可以手动加小图。</p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
