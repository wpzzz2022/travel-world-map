import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdventureForm from "../components/AdventureForm";
import MediaCarousel from "../components/MediaCarousel";
import MediaFolder from "../components/MediaFolder";
import Modal from "../components/Modal";
import PhotoInput from "../components/PhotoInput";
import Missing from "../components/Missing";
import { daysBetween, formatDate, isVideo } from "../lib/media";
import { flagEmoji } from "../lib/geo";
import { useData } from "../lib/store";
import type { Adventure, Photo } from "../types";
import { Stars } from "./AdventuresPage";

export default function AdventureDetailPage() {
  const { advId = "" } = useParams();
  const { data, mutate } = useData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);

  const adv = (data.adventures ?? []).find((a) => a.id === advId);
  if (!adv) return <Missing />;

  const patch = (fn: (a: Adventure) => void) =>
    mutate((d) => {
      const target = (d.adventures ?? []).find((a) => a.id === advId);
      if (target) fn(target);
    });

  const dest = adv.country && adv.destId ? data.countries[adv.country]?.destinations.find((x) => x.id === adv.destId) : undefined;
  const days = daysBetween(adv.dateStart, adv.dateEnd);
  const photoCount = adv.photos.filter((p) => !isVideo(p)).length;
  const videoCount = adv.photos.filter((p) => isVideo(p)).length;

  const remove = () => {
    if (!window.confirm(`删除冒险记录「${adv.title}」？`)) return;
    mutate((d) => {
      d.adventures = (d.adventures ?? []).filter((a) => a.id !== advId);
    });
    navigate("/adventures");
  };

  return (
    <div className="page">
      <nav className="crumb">
        <Link to="/">🌍</Link>
        <Link to="/adventures">🧭 冒险记录</Link>
        <span aria-hidden="true">/</span>
        <b>{adv.title}</b>
      </nav>

      <header className="page-head">
        <h1 className="display page-title">{adv.title}</h1>
        <div className="page-side">
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button type="button" className="btn btn-quiet adv-delete" onClick={remove}>
            删除
          </button>
        </div>
      </header>

      <p className="page-meta adv-meta">
        {(adv.dateStart || adv.dateEnd) && (
          <span>
            📅 {formatDate(adv.dateStart)}
            {adv.dateEnd && adv.dateEnd !== adv.dateStart ? ` ~ ${formatDate(adv.dateEnd)}` : ""}
            {days ? ` · ${days} 天` : ""}
          </span>
        )}
        {adv.rating ? <Stars n={adv.rating} /> : null}
        {dest && adv.country && (
          <Link className="adv-dest" to={`/country/${adv.country}/dest/${adv.destId}`}>
            {flagEmoji(adv.country)} {dest.name}
          </Link>
        )}
      </p>

      {adv.note && <p className="prose lead">{adv.note}</p>}

      <section className="section">
        <h2 className="display section-title">本机相册</h2>
        <MediaFolder
          ownerKey={`adv:${adv.id}`}
          folderName={adv.folderName}
          onChangeFolder={(name) => patch((a) => (a.folderName = name))}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="display section-title">
            手动图片{adv.photos.length > 0 && <span className="section-count">（{photoCount} 张 · {videoCount} 个视频）</span>}
          </h2>
          <button type="button" className="btn" onClick={() => setPhotoModal(true)}>
            ＋ 图片
          </button>
        </div>
        {adv.photos.length === 0 ? (
          <p className="quiet-hint">还没有手动添加的图片。小图可以直接上传存在浏览器里，大图和视频建议用上面的本机相册。</p>
        ) : (
          <MediaCarousel photos={adv.photos} onRemove={(i) => patch((a) => a.photos.splice(i, 1))} />
        )}
      </section>

      {editing && (
        <AdventureForm
          initial={adv}
          onSubmit={(input) => {
            patch((a) => Object.assign(a, input));
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {photoModal && (
        <Modal title={`给「${adv.title}」加图片`} onClose={() => setPhotoModal(false)}>
          <div className="form">
            <p className="form-tip">
              可以贴链接（视频也行，如 <code>/xhs/烟花.mp4</code>），或上传 2MB 内的小图；大批量的照片视频用上面的「本机相册」。
            </p>
            <PhotoInput
              photos={adv.photos}
              onChange={(photos: Photo[]) => patch((a) => (a.photos = photos))}
            />
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setPhotoModal(false)}>
                完成
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
