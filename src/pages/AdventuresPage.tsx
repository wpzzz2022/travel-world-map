import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdventureForm from "../components/AdventureForm";
import { daysBetween, formatDate, isVideo } from "../lib/media";
import { uid, useData } from "../lib/store";
import type { Adventure } from "../types";

export function Stars({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="stars" aria-label={`${n} 星`}>
      {"★".repeat(n)}
      <i>{"☆".repeat(5 - n)}</i>
    </span>
  );
}

export function adventureDays(a: Adventure) {
  return daysBetween(a.dateStart, a.dateEnd);
}

/** 列表封面：优先照片，跳过视频 */
export function adventureCover(a: Adventure): string | undefined {
  return a.photos.find((p) => !isVideo(p))?.url;
}

export default function AdventuresPage() {
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const adventures = [...(data.adventures ?? [])].sort((a, b) =>
    (b.dateStart ?? "").localeCompare(a.dateStart ?? ""),
  );

  const create = (input: Parameters<Parameters<typeof AdventureForm>[0]["onSubmit"]>[0]) => {
    const adv: Adventure = { id: uid(), photos: [], ...input };
    mutate((d) => {
      d.adventures = [...(d.adventures ?? []), adv];
    });
    setCreating(false);
    navigate(`/adventures/${adv.id}`);
  };

  const remove = (adv: Adventure) => {
    if (!window.confirm(`删除冒险记录「${adv.title}」？相册文件夹关联和手动图片会一起删掉。`)) return;
    mutate((d) => {
      d.adventures = (d.adventures ?? []).filter((a) => a.id !== adv.id);
    });
  };

  return (
    <div className="page">
      <nav className="crumb">
        <a href="#/">🌍</a>
        <span aria-hidden="true">/</span>
        <b>🧭 冒险记录</b>
      </nav>

      <header className="page-head">
        <div>
          <h1 className="display page-title">冒险记录</h1>
          <p className="page-meta">
            {adventures.length === 0
              ? "把每一次「去过」记下来：日期、地点、相册和感想。"
              : `记录了 ${adventures.length} 次到访，点开补上照片和视频。`}
          </p>
        </div>
        <div className="page-side">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            ＋ 新建冒险
          </button>
        </div>
      </header>

      {adventures.length === 0 ? (
        <div className="empty">
          <p>
            还没有冒险记录。新建一条，关联去过的城市，写上日期；详情页里可以把电脑里的照片文件夹整个关联过来（照片+视频都会在页面里浏览）。
          </p>
        </div>
      ) : (
        <ul className="rows">
          {adventures.map((a) => {
            const days = adventureDays(a);
            return (
              <li
                key={a.id}
                className="row"
                onClick={() => navigate(`/adventures/${a.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/adventures/${a.id}`)}
                role="link"
                tabIndex={0}
              >
                {adventureCover(a) && <img className="row-thumb" src={adventureCover(a)} alt="" loading="lazy" />}
                <div className="row-main">
                  <h2 className="display row-title">{a.title}</h2>
                  {a.note && <p className="row-desc">{a.note}</p>}
                  <p className="row-meta">
                    {(a.dateStart || a.dateEnd) && (
                      <span>
                        📅 {formatDate(a.dateStart)}
                        {a.dateEnd && a.dateEnd !== a.dateStart ? ` ~ ${formatDate(a.dateEnd)}` : ""}
                        {days ? ` · ${days} 天` : ""}
                      </span>
                    )}
                    <Stars n={a.rating} />
                    {a.folderName && <span> · 📁 {a.folderName}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn row-remove"
                  aria-label={`删除冒险记录 ${a.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(a);
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && <AdventureForm onSubmit={create} onClose={() => setCreating(false)} />}
    </div>
  );
}
