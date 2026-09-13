import { useState } from "react";
import type { Photo } from "../types";
import { isVideo } from "../lib/media";

/** 媒体墙：照片直接展示，视频显示首帧 + 播放角标；点击进入灯箱（视频可播放） */
export default function Gallery({
  photos,
  onRemove,
  compact,
}: {
  photos: Photo[];
  onRemove?: (index: number) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;

  const current = open !== null ? photos[open] : null;

  return (
    <>
      <div className={`gallery${compact ? " gallery-compact" : ""}`}>
        {photos.map((p, i) => (
          <figure key={`${p.url}-${i}`} className="gallery-item">
            <button type="button" onClick={() => setOpen(i)} title={p.caption || (isVideo(p) ? "播放视频" : "查看大图")}>
              {isVideo(p) ? (
                <span className="gallery-video-thumb">
                  <video src={p.url} muted preload="metadata" tabIndex={-1} />
                  <i className="gallery-video-badge" aria-hidden="true">
                    ▶
                  </i>
                </span>
              ) : (
                <img src={p.url} alt={p.caption || "照片"} loading="lazy" />
              )}
            </button>
            {p.caption && <figcaption>{p.caption}</figcaption>}
            {onRemove && (
              <button
                type="button"
                className="gallery-remove"
                onClick={() => onRemove(i)}
                aria-label={isVideo(p) ? "删除这个视频" : "删除这张图片"}
              >
                ✕
              </button>
            )}
          </figure>
        ))}
      </div>

      {current && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          {isVideo(current) ? (
            <video
              src={current.url}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="lightbox-video"
            />
          ) : (
            <img src={current.url} alt={current.caption || ""} onClick={(e) => e.stopPropagation()} />
          )}
          {current.caption && <p className="lightbox-caption">{current.caption}</p>}
          {photos.length > 1 && (
            <div className="lightbox-nav" onClick={(e) => e.stopPropagation()}>
              <button type="button" disabled={open === 0} onClick={() => setOpen((open ?? 0) - 1)}>
                ‹
              </button>
              <span>
                {(open ?? 0) + 1} / {photos.length}
              </span>
              <button
                type="button"
                disabled={open === photos.length - 1}
                onClick={() => setOpen((open ?? 0) + 1)}
              >
                ›
              </button>
            </div>
          )}
          <button type="button" className="lightbox-close" onClick={() => setOpen(null)} aria-label="关闭">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
