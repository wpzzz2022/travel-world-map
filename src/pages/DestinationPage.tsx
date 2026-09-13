import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdventureForm from "../components/AdventureForm";
import Modal from "../components/Modal";
import CoordsField from "../components/CoordsField";
import Missing from "../components/Missing";
import { cnCityByCode } from "../data/china";
import { alpha2Of, countryCenter, countryName, COUNTRY_FEATURES, flagEmoji } from "../lib/geo";
import { uid, useData } from "../lib/store";
import type { Adventure, Destination, Photo, Spot, TravelData } from "../types";

function firstPhoto(spot: Spot): Photo | undefined {
  // 列表缩略图用 <img>，视频跳过
  return (
    spot.photos.find((p) => !p.video && !/\.(mp4|m4v|webm|mov|avi|mkv)(\?.*)?$/i.test(p.url)) ??
    spot.checkins.find((c) => c.photos.length > 0)?.photos[0] ??
    spot.posts.find((p) => p.images.length > 0)?.images[0]
  );
}

export default function DestinationPage() {
  const { code = "", destId = "" } = useParams();
  const upper = code.toUpperCase();
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [advForm, setAdvForm] = useState(false);

  const cityMeta = upper === "CN" ? cnCityByCode(destId) : undefined;
  const real = data.countries[upper]?.destinations.find((d) => d.id === destId);
  // 中国的市级城市即使还没记录也能打开（显示为"还没去"），其他地区仍要求先创建
  const dest: Destination | undefined = real ?? (cityMeta ? { id: cityMeta.code, name: cityMeta.name, status: "dream", coords: cityMeta.wgsCenter, spots: [] } : undefined);
  if (!dest) return <Missing />;

  const feature = COUNTRY_FEATURES.find((f) => alpha2Of(f) === upper);
  const countryLabel = feature ? countryName(feature) : upper;

  /** draft 里拿到可变更的目的地记录；中国的"还没去"城市在第一次修改时自动建档 */
  const ensureReal = (draft: TravelData): Destination | undefined => {
    const entry = draft.countries[upper] ?? (draft.countries[upper] = { destinations: [] });
    let target = entry.destinations.find((x) => x.id === destId);
    if (!target && cityMeta) {
      target = { id: cityMeta.code, name: cityMeta.name, status: "dream", coords: cityMeta.wgsCenter, spots: [] };
      entry.destinations.push(target);
    }
    return target;
  };

  /** 状态三态切换：还没去 → 想去 → 去过 →（没有内容时退回）还没去 */
  const cycleStatus = () =>
    mutate((d) => {
      const target = ensureReal(d);
      if (!target) return;
      if (!real) return; // "还没去"的第一次点击：ensureReal 已建档，默认就是"想去"
      const entry = d.countries[upper]!;
      if (target.status === "dream") {
        target.status = "visited";
      } else if (target.spots.length === 0 && !target.summary) {
        entry.destinations = entry.destinations.filter((x) => x.id !== destId);
        if (entry.destinations.length === 0) delete d.countries[upper];
      } else {
        target.status = "dream";
      }
    });

  const statusLabel = !real ? "还没去" : dest.status === "visited" ? "去过" : "想去";

  /** 去过的城市可以直接开一条冒险记录 */
  const startAdventure = () => {
    if (real?.status !== "visited") return;
    setAdvForm(true);
  };

  const submitSpot = (input: { name: string; description: string; coords: [number, number] | null }) => {
    mutate((d) => {
      const target = ensureReal(d);
      target?.spots.push({
        id: uid(),
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        coords: input.coords ?? undefined,
        checkins: [],
        posts: [],
        photos: [],
      });
    });
    setAdding(false);
  };

  const removeSpot = (id: string, spotName: string) => {
    if (!window.confirm(`删除景点「${spotName}」？打卡点和笔记会一起删掉。`)) return;
    mutate((d) => {
      const target = d.countries[upper]?.destinations.find((x) => x.id === destId);
      if (target) target.spots = target.spots.filter((s) => s.id !== id);
    });
  };

  return (
    <div className="page">
      <nav className="crumb">
        <Link to="/">🌍</Link>
        <Link to={`/country/${upper}`}>
          {flagEmoji(upper)} {countryLabel}
        </Link>
        {cityMeta && <Link to="/country/CN">{cityMeta.province.replace(/(省|市|自治区|特别行政区)$/, "")}</Link>}
        <span aria-hidden="true">/</span>
        <b>{dest.name}</b>
      </nav>

      <header className="page-head">
        <h1 className="display page-title">{dest.name}</h1>
        <div className="page-side">
          <button type="button" className="btn status-toggle" onClick={cycleStatus} title="点击切换：还没去 → 想去 → 去过">
            <i className={`dot dot-${real ? dest.status : "none"}`} aria-hidden="true" />
            {statusLabel}
          </button>
          {real?.status === "visited" && (
            <button type="button" className="btn" onClick={startAdventure} title="为这次到访建一条冒险记录">
              🧭 冒险记录
            </button>
          )}
          <button type="button" className="btn" onClick={() => setPlanning(true)}>
            🧳 加入行程
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            ＋ 添加景点
          </button>
        </div>
      </header>
      {dest.summary && <p className="prose lead">{dest.summary}</p>}

      {dest.spots.length === 0 ? (
        <div className="empty">
          <p>还没有景点。把攻略里看到的店、博物馆、观景台都放进来，再逐个补打卡点。</p>
        </div>
      ) : (
        <ul className="rows">
          {dest.spots.map((spot) => {
            const photo = firstPhoto(spot);
            const photos = spot.photos.length + spot.checkins.reduce((n, c) => n + c.photos.length, 0);
            return (
              <li
                key={spot.id}
                className="row row-spot"
                onClick={() => navigate(`/country/${upper}/dest/${dest.id}/spot/${spot.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/country/${upper}/dest/${dest.id}/spot/${spot.id}`);
                }}
                role="link"
                tabIndex={0}
              >
                {photo && (
                  <img className="row-thumb" src={photo.url} alt="" loading="lazy" aria-hidden="true" />
                )}
                <div className="row-main">
                  <h2 className="display row-title">{spot.name}</h2>
                  {spot.description && <p className="row-desc">{spot.description}</p>}
                  <p className="row-meta">
                    {spot.checkins.length} 个打卡点 · {spot.posts.length} 条小红书笔记 · {photos} 张图片
                    {spot.coords ? "" : " · 未标坐标"}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn row-remove"
                  aria-label={`删除景点 ${spot.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSpot(spot.id, spot.name);
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && <SpotForm onSubmit={submitSpot} onClose={() => setAdding(false)} center={cityMeta?.wgsCenter ?? countryCenter(upper)} />}
      {planning && (
        <AddToTripModal
          destName={dest.name}
          country={upper}
          destId={dest.id}
          plans={data.trips ?? []}
          onClose={() => setPlanning(false)}
        />
      )}

      {advForm && (
        <AdventureForm
          presetDest={{ country: upper, destId: dest.id, name: dest.name }}
          onSubmit={(input) => {
            const adv: Adventure = { id: uid(), photos: [], ...input };
            mutate((d) => {
              d.adventures = [...(d.adventures ?? []), adv];
            });
            setAdvForm(false);
            navigate(`/adventures/${adv.id}`);
          }}
          onClose={() => setAdvForm(false)}
        />
      )}
    </div>
  );
}

/** 把当前目的地加入一个待出行计划（可选新建） */
function AddToTripModal({
  destName,
  country,
  destId,
  plans,
  onClose,
}: {
  destName: string;
  country: string;
  destId: string;
  plans: NonNullable<TravelData["trips"]>;
  onClose: () => void;
}) {
  const { mutate } = useData();
  const navigate = useNavigate();
  const open = plans.filter((t) => t.status === "planning");
  const [selected, setSelected] = useState(open[0]?.id ?? "new");
  const [newTitle, setNewTitle] = useState("");
  const [days, setDays] = useState(2);

  const submit = () => {
    const leg = { id: uid(), title: destName, country, destId, days: Math.max(1, Math.round(days)) };
    if (selected === "new") {
      const title = newTitle.trim() || `${destName}之旅`;
      const trip = { id: uid(), title, status: "planning" as const, legs: [leg], createdAt: new Date().toISOString() };
      mutate((d) => {
        d.trips = [...(d.trips ?? []), trip];
      });
      navigate(`/plans/${trip.id}`);
    } else {
      mutate((d) => {
        const trip = (d.trips ?? []).find((t) => t.id === selected);
        trip?.legs.push(leg);
      });
      onClose();
    }
  };

  return (
    <Modal title={`把「${destName}」加入行程`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {open.length > 0 && (
          <fieldset className="field status-field trip-picker">
            <legend>加入哪个计划</legend>
            {open.map((t) => (
              <label className="radio" key={t.id}>
                <input type="radio" name="trip-pick" checked={selected === t.id} onChange={() => setSelected(t.id)} />
                {t.title}（{t.legs.length} 站）
              </label>
            ))}
            <label className="radio">
              <input type="radio" name="trip-pick" checked={selected === "new"} onChange={() => setSelected("new")} />
              新建计划…
            </label>
          </fieldset>
        )}
        {selected === "new" && (
          <label className="field">
            新计划名称
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={`例如：${destName}五日`} />
          </label>
        )}
        <label className="field trip-days-field">
          这一站待几天
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            {selected === "new" ? "创建并加入" : "加入"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SpotForm({
  onSubmit,
  onClose,
  center,
}: {
  onSubmit: (input: { name: string; description: string; coords: [number, number] | null }) => void;
  onClose: () => void;
  center?: [number, number] | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<[number, number] | null>(null);

  return (
    <Modal title="添加景点" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit({ name, description, coords });
        }}
      >
        <label className="field">
          名称
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：浅草寺" required />
        </label>
        <label className="field">
          介绍
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="怎么去、玩什么、避坑提示……以后随时可以补"
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
