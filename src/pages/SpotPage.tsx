import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Modal from "../components/Modal";
import CoordsField from "../components/CoordsField";
import Gallery from "../components/Gallery";
import MediaCarousel from "../components/MediaCarousel";
import MediaFolder from "../components/MediaFolder";
import Missing from "../components/Missing";
import PhotoInput from "../components/PhotoInput";
import SpotMap from "../components/SpotMap";
import XhsPostCard from "../components/XhsPostCard";
import { alpha2Of, countryCenter, countryName, COUNTRY_FEATURES, flagEmoji } from "../lib/geo";
import { formatCoords, mapLinks } from "../lib/maps";
import { uid, useData } from "../lib/store";
import type { CheckinPoint, Photo, Spot, XhsPost } from "../types";

export default function SpotPage() {
  const { code = "", destId = "", spotId = "" } = useParams();
  const upper = code.toUpperCase();
  const { data, mutate } = useData();

  const [photoTarget, setPhotoTarget] = useState<"spot" | CheckinPoint | null>(null);
  const [addingCheckin, setAddingCheckin] = useState(false);
  const [addingPost, setAddingPost] = useState(false);

  const dest = data.countries[upper]?.destinations.find((d) => d.id === destId);
  const spot = dest?.spots.find((s) => s.id === spotId);
  if (!dest || !spot) return <Missing />;

  const feature = COUNTRY_FEATURES.find((f) => alpha2Of(f) === upper);
  const countryLabel = feature ? countryName(feature) : upper;

  const patchSpot = (fn: (s: Spot) => void) =>
    mutate((d) => {
      const s = d.countries[upper]?.destinations.find((x) => x.id === destId)?.spots.find((x) => x.id === spotId);
      if (s) fn(s);
    });

  const patchCheckin = (ckId: string, fn: (c: CheckinPoint) => void) =>
    patchSpot((s) => {
      const c = s.checkins.find((x) => x.id === ckId);
      if (c) fn(c);
    });

  const photoList = photoTarget === "spot" ? spot.photos : photoTarget ? photoTarget.photos : [];
  const savePhotos = (photos: Photo[]) => {
    if (photoTarget === "spot") patchSpot((s) => (s.photos = photos));
    else if (photoTarget) patchCheckin(photoTarget.id, (c) => (c.photos = photos));
    setPhotoTarget(null);
  };

  const submitCheckin = (input: { name: string; description: string; coords: [number, number] | null }) => {
    patchSpot((s) =>
      s.checkins.push({
        id: uid(),
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        coords: input.coords ?? undefined,
        photos: [],
      }),
    );
    setAddingCheckin(false);
  };

  const submitPost = (input: Omit<XhsPost, "id">) => {
    patchSpot((s) => s.posts.push({ ...input, id: uid() }));
    setAddingPost(false);
  };

  const photoCount =
    spot.photos.length + spot.checkins.reduce((n, c) => n + c.photos.length, 0) + spot.posts.reduce((n, p) => n + p.images.length, 0);

  return (
    <div className="page">
      <nav className="crumb">
        <Link to="/">🌍</Link>
        <Link to={`/country/${upper}`}>
          {flagEmoji(upper)} {countryLabel}
        </Link>
        <Link to={`/country/${upper}/dest/${dest.id}`}>{dest.name}</Link>
        <span aria-hidden="true">/</span>
        <b>{spot.name}</b>
      </nav>

      <header className="page-head">
        <h1 className="display page-title">{spot.name}</h1>
        <div className="page-side">
          <p className="page-meta">
            {spot.checkins.length} 个打卡点 · {spot.posts.length} 条笔记 · {photoCount} 张图片
          </p>
          <div className="page-actions">
            <button type="button" className="btn" onClick={() => setPhotoTarget("spot")}>
              ＋ 图片
            </button>
            <button type="button" className="btn" onClick={() => setAddingCheckin(true)}>
              ＋ 打卡点
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAddingPost(true)}>
              ＋ 小红书笔记
            </button>
          </div>
        </div>
      </header>

      {spot.description && <p className="prose lead">{spot.description}</p>}
      {spot.coords && (
        <p className="map-open">
          <span>位置 {formatCoords(spot.coords)}，打开地图：</span>
          {mapLinks(spot.coords).map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.name}
            </a>
          ))}
        </p>
      )}

      <section className="section">
        <h2 className="display section-title">景点地图</h2>
        <SpotMap spot={spot} />
        <p className="form-tip">金色菱形是景点，绿色圆点是打卡点；点标记可以看照片。</p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="display section-title">
            照片与视频
            {spot.photos.length > 0 && <span className="section-count">（{spot.photos.length} 项）</span>}
          </h2>
          <button type="button" className="btn" onClick={() => setPhotoTarget("spot")}>
            ＋ 图片 / 视频链接
          </button>
        </div>
        {spot.photos.length > 0 ? (
          <MediaCarousel photos={spot.photos} onRemove={(i) => patchSpot((s) => s.photos.splice(i, 1))} />
        ) : (
          <p className="quiet-hint">
            还没有图片。小图/视频链接用上面的按钮添加；电脑里成批的照片视频，用下面的本机相册关联文件夹。
          </p>
        )}
        <MediaFolder
          ownerKey={`spot:${spot.id}`}
          folderName={spot.folderName}
          onChangeFolder={(name) => patchSpot((s) => (s.folderName = name))}
        />
      </section>

      <section className="section">
        <h2 className="display section-title">打卡点</h2>
        {spot.checkins.length === 0 ? (
          <p className="empty">还没有打卡点：把攻略里的机位、店门口、观景台记进来，配上坐标和照片。</p>
        ) : (
          <ol className="checkins">
            {spot.checkins.map((ck, i) => (
              <li key={ck.id} className="checkin">
                <div className="checkin-head">
                  <i className="pin-checkin pin-static" aria-hidden="true">
                    {i + 1}
                  </i>
                  <h3 className="display checkin-name">{ck.name}</h3>
                  <div className="checkin-actions">
                    <button type="button" className="btn btn-quiet" onClick={() => setPhotoTarget(ck)}>
                      ＋ 图片
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`删除打卡点 ${ck.name}`}
                      onClick={() => {
                        if (window.confirm(`删除打卡点「${ck.name}」？`)) patchSpot((s) => (s.checkins = s.checkins.filter((c) => c.id !== ck.id)));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {ck.description && <p className="prose">{ck.description}</p>}
                {ck.coords && (
                  <p className="map-open">
                    <span>{formatCoords(ck.coords)}：</span>
                    {mapLinks(ck.coords).map((l) => (
                      <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.name}
                      </a>
                    ))}
                  </p>
                )}
                {ck.photos.length > 0 ? (
                  <Gallery photos={ck.photos} compact onRemove={(idx) => patchCheckin(ck.id, (c) => c.photos.splice(idx, 1))} />
                ) : (
                  <p className="quiet-hint">还没有图片。</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section">
        <h2 className="display section-title">小红书笔记</h2>
        {spot.posts.length === 0 ? (
          <p className="empty">把收藏过的攻略帖链接贴进来，图片存到 public/xhs/ 后加进来，做攻略时一眼对上。</p>
        ) : (
          <div className="xhs-list">
            {spot.posts.map((p) => (
              <XhsPostCard
                key={p.id}
                post={p}
                onDelete={() => {
                  if (window.confirm("删除这条笔记的关联？")) patchSpot((s) => (s.posts = s.posts.filter((x) => x.id !== p.id)));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {photoTarget && (
        <PhotoModal
          title={photoTarget === "spot" ? `给「${spot.name}」加图片` : `给「${photoTarget.name}」加图片`}
          photos={photoList}
          onSave={savePhotos}
          onClose={() => setPhotoTarget(null)}
        />
      )}

      {addingCheckin && (
        <CheckinForm onSubmit={submitCheckin} onClose={() => setAddingCheckin(false)} center={countryCenter(upper)} />
      )}

      {addingPost && <PostForm onSubmit={submitPost} onClose={() => setAddingPost(false)} />}
    </div>
  );
}

function PhotoModal({
  title,
  photos,
  onSave,
  onClose,
}: {
  title: string;
  photos: Photo[];
  onSave: (photos: Photo[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Photo[]>(photos);
  return (
    <Modal title={title} onClose={onClose}>
        <div className="form">
          <p className="form-tip">
            可以贴图片或视频链接（推荐把素材存到 <code>public/xhs/</code> 后填 <code>/xhs/文件名.jpg</code>），小图也可以直接上传；
            大批量的照片视频建议在页面下方的「本机相册」里关联文件夹。
          </p>
          <PhotoInput photos={draft} onChange={setDraft} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            保存图片
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CheckinForm({
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
    <Modal title="添加打卡点" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit({ name, description, coords });
        }}
      >
        <label className="field">
          名称
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：雷门" required />
        </label>
        <label className="field">
          说明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="机位、排队情况、最佳时间……"
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

function PostForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: Omit<XhsPost, "id">) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<Photo[]>([]);
  const [error, setError] = useState("");

  const urlOk = /^https?:\/\/|^\/xhs\//.test(url.trim());
  const submit = () => {
    const clean = url.trim();
    if (!/^https?:\/\//.test(clean)) {
      setError("请贴小红书笔记的完整链接（http 开头，分享面板里复制即可）");
      return;
    }
    onSubmit({ url: clean, title: title.trim() || undefined, author: author.trim() || undefined, note: note.trim() || undefined, images });
  };

  return (
    <Modal title="关联小红书笔记" onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          笔记链接
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="https://www.xiaohongshu.com/explore/…"
            required
          />
        </label>
        <div className="field-grid">
          <label className="field">
            标题（可选）
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="东京浅草寺拍照攻略" />
          </label>
          <label className="field">
            作者（可选）
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="博主昵称" />
          </label>
        </div>
        <label className="field">
          备注（可选）
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="这条笔记主要讲什么" />
        </label>
        <div className="field">
          <span className="field-label">笔记图片（可选，从笔记里存下来的图）</span>
          <PhotoInput photos={images} onChange={setImages} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <p className="form-tip">小红书没有对外开放的笔记接口，目前用「存链接 + 存图」的方式；批量下载图片见 README。</p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={!urlOk}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
