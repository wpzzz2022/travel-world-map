import { useEffect, useState } from "react";
import type { Photo } from "../types";
import { isVideo } from "../lib/media";

/**
 * 大框媒体轮播：照片/视频轮流展示，悬停暂停，视频播完自动到下一张；
 * 下方缩略图条可跳转、可删除（配合手动图片管理）。
 */
export default function MediaCarousel({
  photos,
  onRemove,
}: {
  photos: Photo[];
  onRemove?: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);

  const i = Math.min(index, Math.max(photos.length - 1, 0));
  const cur = photos[i];

  // 图片每 4 秒自动切下一张；悬停暂停；视频不打断（播完 onEnded 自动切）
  useEffect(() => {
    if (hover || photos.length < 2 || !cur || isVideo(cur)) return;
    const t = window.setInterval(() => setIndex((x) => (x + 1) % photos.length), 4000);
    return () => window.clearInterval(t);
  }, [hover, i, photos, cur]);

  const go = (d: number) => setIndex((x) => (x + d + photos.length) % photos.length);

  if (photos.length === 0) return null;

  return (
    <div className="carousel">
      <div
        className="carousel-frame"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {isVideo(cur) ? (
          <video
            key={cur.url}
            src={cur.url}
            controls
            autoPlay
            muted
            playsInline
            onEnded={() => photos.length > 1 && go(1)}
          />
        ) : (
          <img key={cur.url} src={cur.url} alt={cur.caption || "照片"} />
        )}
        {photos.length > 1 && (
          <>
            <button type="button" className="carousel-arrow" aria-label="上一张" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className="carousel-arrow carousel-arrow-next" aria-label="下一张" onClick={() => go(1)}>
              ›
            </button>
            <span className="carousel-counter">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {cur.caption && <p className="carousel-caption">{cur.caption}</p>}

      {photos.length > 1 && (
        <div className="carousel-thumbs">
          {photos.map((p, idx) => (
            <span
              key={`${p.url}-${idx}`}
              role="button"
              tabIndex={0}
              className={`carousel-thumb${idx === i ? " carousel-thumb-active" : ""}`}
              onClick={() => setIndex(idx)}
              onKeyDown={(e) => e.key === "Enter" && setIndex(idx)}
              aria-label={isVideo(p) ? `跳到视频 ${idx + 1}` : `跳到图片 ${idx + 1}`}
            >
              {isVideo(p) ? (
                <span className="carousel-thumb-video">
                  <video src={p.url} muted preload="metadata" tabIndex={-1} />
                  <i className="gallery-video-badge" aria-hidden="true">
                    ▶
                  </i>
                </span>
              ) : (
                <img src={p.url} alt="" loading="lazy" />
              )}
              {onRemove && (
                <button
                  type="button"
                  className="carousel-remove"
                  aria-label={`删除第 ${idx + 1} 项`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(idx);
                  }}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
