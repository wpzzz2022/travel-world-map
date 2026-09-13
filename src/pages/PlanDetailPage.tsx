import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal";
import Missing from "../components/Missing";
import { flagEmoji } from "../lib/geo";
import { uid, useData } from "../lib/store";
import type { TripLeg } from "../types";

export default function PlanDetailPage() {
  const { planId = "" } = useParams();
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const trip = (data.trips ?? []).find((t) => t.id === planId);
  if (!trip) return <Missing />;

  const totalDays = trip.legs.reduce((n, l) => n + (Number(l.days) || 0), 0);

  const patch = (fn: (t: NonNullable<typeof trip>) => void) =>
    mutate((d) => {
      const target = (d.trips ?? []).find((t) => t.id === planId);
      if (target) fn(target);
    });

  const removeLeg = (id: string) =>
    patch((t) => {
      t.legs = t.legs.filter((l) => l.id !== id);
    });

  const moveLeg = (index: number, delta: number) =>
    patch((t) => {
      const next = index + delta;
      if (next < 0 || next >= t.legs.length) return;
      [t.legs[index], t.legs[next]] = [t.legs[next], t.legs[index]];
    });

  const removeTrip = () => {
    if (!window.confirm(`删除计划「${trip.title}」？`)) return;
    mutate((d) => {
      d.trips = (d.trips ?? []).filter((t) => t.id !== planId);
    });
    navigate("/plans");
  };

  return (
    <div className="page">
      <nav className="crumb">
        <Link to="/">🌍</Link>
        <Link to="/plans">🧳 旅行计划</Link>
        <span aria-hidden="true">/</span>
        <b>{trip.title}</b>
      </nav>

      <header className="page-head">
        <input
          className="plan-title display"
          value={trip.title}
          aria-label="计划名称"
          onChange={(e) => patch((t) => (t.title = e.target.value))}
          placeholder="计划名称"
        />
        <div className="page-side">
          <button
            type="button"
            className="btn status-toggle"
            onClick={() => patch((t) => (t.status = t.status === "planning" ? "done" : "planning"))}
          >
            <i className={`dot ${trip.status === "done" ? "dot-visited" : "dot-dream"}`} aria-hidden="true" />
            {trip.status === "done" ? "已出行" : "待出行"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            ＋ 添加行程段
          </button>
        </div>
      </header>

      <p className="page-meta">
        {trip.legs.length} 站 · 共 {totalDays} 天
        {trip.legs.length > 0 && " · 用 ↑↓ 调整顺序"}
      </p>

      {trip.legs.length === 0 ? (
        <div className="empty">
          <p>还没有行程段。点「＋ 添加行程段」从已记录的目的地里挑，或者自由填一站；也可以在城市页点「🧳 加入行程」把它串进来。</p>
        </div>
      ) : (
        <ol className="plan-legs">
          {trip.legs.map((leg, i) => (
            <LegRow
              key={leg.id}
              leg={leg}
              index={i}
              count={trip.legs.length}
              onMove={(delta) => moveLeg(i, delta)}
              onRemove={() => removeLeg(leg.id)}
              onChange={(next) => patch((t) => (t.legs[i] = next))}
            />
          ))}
        </ol>
      )}

      <section className="section">
        <h2 className="display section-title">备注</h2>
        <textarea
          className="plan-note"
          value={trip.note ?? ""}
          onChange={(e) => patch((t) => (t.note = e.target.value))}
          rows={3}
          placeholder="机票、酒店、签证、预算……"
        />
      </section>

      <section className="section">
        <button type="button" className="btn btn-quiet plan-delete" onClick={removeTrip}>
          删除这个计划
        </button>
      </section>

      {adding && (
        <AddLegModal
          onPick={(title, country, destId) => {
            patch((t) => t.legs.push({ id: uid(), title, country, destId, days: 2 }));
            setAdding(false);
          }}
          onFree={(title, days) => {
            patch((t) => t.legs.push({ id: uid(), title, days }));
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function LegRow({
  leg,
  index,
  count,
  onMove,
  onRemove,
  onChange,
}: {
  leg: TripLeg;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onChange: (next: TripLeg) => void;
}) {
  const linked = leg.country && leg.destId ? `/country/${leg.country}/dest/${leg.destId}` : undefined;
  return (
    <li className="plan-leg">
      <span className="plan-leg-no display" aria-hidden="true">
        {index + 1}
      </span>
      <div className="plan-leg-main">
        {linked ? (
          <Link className="plan-leg-title" to={linked}>
            {flagEmoji(leg.country!)} {leg.title}
          </Link>
        ) : (
          <input
            className="plan-leg-title-input"
            value={leg.title}
            aria-label="站点名称"
            onChange={(e) => onChange({ ...leg, title: e.target.value })}
            placeholder="站名，例如：敦煌"
          />
        )}
        <input
          className="plan-leg-note"
          value={leg.note ?? ""}
          aria-label="这一站的备注"
          onChange={(e) => onChange({ ...leg, note: e.target.value })}
          placeholder="想做什么、住哪、吃什么…"
        />
      </div>
      <div className="plan-leg-days">
        <button type="button" className="btn btn-quiet" aria-label="减少天数" onClick={() => onChange({ ...leg, days: Math.max(1, leg.days - 1) })}>
          −
        </button>
        <span className="plan-leg-days-n">
          {leg.days} <i>天</i>
        </span>
        <button type="button" className="btn btn-quiet" aria-label="增加天数" onClick={() => onChange({ ...leg, days: Math.min(60, leg.days + 1) })}>
          ＋
        </button>
      </div>
      <div className="plan-leg-tools">
        <button type="button" className="icon-btn" aria-label="上移" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="icon-btn" aria-label="下移" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className="icon-btn" aria-label={`删除 ${leg.title}`} onClick={onRemove}>
          ✕
        </button>
      </div>
    </li>
  );
}

/** 从已有目的地里挑一站，或自由填写 */
function AddLegModal({
  onPick,
  onFree,
  onClose,
}: {
  onPick: (title: string, country: string, destId: string) => void;
  onFree: (title: string, days: number) => void;
  onClose: () => void;
}) {
  const { data } = useData();
  const [freeName, setFreeName] = useState("");
  const [freeDays, setFreeDays] = useState(1);

  const dests = Object.entries(data.countries).flatMap(([code, entry]) =>
    entry.destinations.map((d) => ({ code, dest: d })),
  );

  return (
    <Modal title="添加行程段" onClose={onClose} wide>
      <div className="form">
        {dests.length > 0 && (
          <div className="field">
            <span className="field-label">从已记录的目的地里挑</span>
            <ul className="plan-pick">
              {dests.map(({ code, dest }) => (
                <li key={`${code}-${dest.id}`}>
                  <button
                    type="button"
                    className="plan-pick-item"
                    onClick={() => onPick(dest.name, code, dest.id)}
                  >
                    <i className={`dot dot-${dest.status}`} aria-hidden="true" />
                    {flagEmoji(code)} {dest.name}
                    <span className="plan-pick-sub">
                      {dest.spots.length} 个景点
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="field">
          <span className="field-label">或者自由添加一站（还不属于任何目的地）</span>
          <div className="plan-free">
            <input
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              placeholder="站名，例如：敦煌"
              aria-label="站点名称"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={freeDays}
              onChange={(e) => setFreeDays(Number(e.target.value) || 1)}
              aria-label="天数"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!freeName.trim()}
              onClick={() => onFree(freeName.trim(), Math.max(1, Math.round(freeDays)))}
            >
              添加
            </button>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}
