import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { uid, useData } from "../lib/store";
import type { Trip } from "../types";

function tripSummary(trip: Trip): string {
  if (trip.legs.length === 0) return "还没安排行程段";
  return trip.legs.map((l) => `${l.title} ${l.days}天`).join(" → ");
}

function totalDays(trip: Trip): number {
  return trip.legs.reduce((n, l) => n + (Number(l.days) || 0), 0);
}

export default function PlansPage() {
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const trips = [...(data.trips ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const planning = trips.filter((t) => t.status === "planning");
  const done = trips.filter((t) => t.status === "done");

  const create = (title: string) => {
    const trip: Trip = { id: uid(), title: title.trim() || "未命名行程", status: "planning", legs: [], createdAt: new Date().toISOString() };
    mutate((d) => {
      d.trips = [...(d.trips ?? []), trip];
    });
    setCreating(false);
    navigate(`/plans/${trip.id}`);
  };

  const remove = (trip: Trip) => {
    if (!window.confirm(`删除计划「${trip.title}」？`)) return;
    mutate((d) => {
      d.trips = (d.trips ?? []).filter((t) => t.id !== trip.id);
    });
  };

  const Row = ({ trip }: { trip: Trip }) => (
    <li
      className="row"
      onClick={() => navigate(`/plans/${trip.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/plans/${trip.id}`)}
      role="link"
      tabIndex={0}
    >
      <div className="row-main">
        <h2 className="display row-title">{trip.title}</h2>
        <p className="row-desc">{tripSummary(trip)}</p>
        <p className="row-meta">
          <i className={`dot ${trip.status === "done" ? "dot-visited" : "dot-dream"}`} aria-hidden="true" />
          {trip.status === "done" ? "已出行" : "待出行"}
          <span> · {trip.legs.length} 站 · 共 {totalDays(trip)} 天</span>
        </p>
      </div>
      <button
        type="button"
        className="icon-btn row-remove"
        aria-label={`删除计划 ${trip.title}`}
        onClick={(e) => {
          e.stopPropagation();
          remove(trip);
        }}
      >
        ✕
      </button>
    </li>
  );

  return (
    <div className="page">
      <nav className="crumb">
        <a href="#/">🌍</a>
        <span aria-hidden="true">/</span>
        <b>🧳 旅行计划</b>
      </nav>

      <header className="page-head">
        <div>
          <h1 className="display page-title">旅行计划</h1>
          <p className="page-meta">把想去的城市串成一条线，估好每一站的天数，出发前逐个订票。</p>
        </div>
        <div className="page-side">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            ＋ 新建计划
          </button>
        </div>
      </header>

      {planning.length === 0 ? (
        <div className="empty">
          <p>
            还没有待出行的计划。新建一个，然后从城市页点「🧳 加入行程」把想去的地方串起来；也可以直接在计划里自由添加站点。
          </p>
        </div>
      ) : (
        <ul className="rows">
          {planning.map((t) => (
            <Row key={t.id} trip={t} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="section">
          <h2 className="display section-title">已出行</h2>
          <ul className="rows">
            {done.map((t) => (
              <Row key={t.id} trip={t} />
            ))}
          </ul>
        </section>
      )}

      {creating && <CreateForm onSubmit={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateForm({ onSubmit, onClose }: { onSubmit: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <Modal title="新建旅行计划" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(title);
        }}
      >
        <label className="field">
          计划名称
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：关东秋日五日" />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            创建
          </button>
        </div>
      </form>
    </Modal>
  );
}
