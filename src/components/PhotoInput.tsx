import { useRef, useState } from "react";
import type { Photo } from "../types";
import { isVideo, isVideoUrl } from "../lib/media";

/** 在表单里管理一组图片/视频：粘贴链接 / 本地上传小图（转 base64），可加说明、可删除 */
export default function PhotoInput({ photos, onChange }: { photos: Photo[]; onChange: (photos: Photo[]) => void }) {
  const [link, setLink] = useState("");
  const [tip, setTip] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/|data:image\/|data:video\/)/.test(url)) {
      setTip("链接需要以 http(s):// 或 / 开头（站内素材放 public/xhs/ 后填 /xhs/xxx.mp4）");
      return;
    }
    setTip("");
    onChange([...photos, { url, video: isVideoUrl(url) || undefined }]);
    setLink("");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const added: Photo[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith("video/")) {
        problems.push(`视频太大，不适合存进浏览器：${file.name}（请用「关联本机相册」或放到 public/xhs/ 用链接引用）`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        problems.push(`跳过非图片：${file.name}`);
        continue;
      }
      if (file.size > 2 * 1024 * 1024) {
        problems.push(`超过 2MB，请压缩后再传：${file.name}`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      added.push({ url: dataUrl });
    }
    if (added.length) onChange([...photos, ...added]);
    setTip(problems.join("；"));
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateCaption = (i: number, caption: string) => {
    const next = photos.map((p, idx) => (idx === i ? { ...p, caption: caption || undefined } : p));
    onChange(next);
  };

  return (
    <div className="photo-input">
      {photos.length > 0 && (
        <ul className="photo-input-list">
          {photos.map((p, i) => (
            <li key={`${p.url}-${i}`}>
              {isVideo(p) ? (
                <span className="photo-input-video" aria-hidden="true">
                  ▶
                </span>
              ) : (
                <img src={p.url} alt="" />
              )}
              <input
                type="text"
                value={p.caption ?? ""}
                placeholder="说明（可选）"
                onChange={(e) => updateCaption(i, e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="移除这一项"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="photo-input-actions">
        <input
          type="text"
          value={link}
          placeholder="粘贴图片/视频链接，如 /xhs/雷门1.jpg"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
        />
        <button type="button" className="btn" onClick={addLink}>
          加链接
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          上传图片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>
      {tip && <p className="form-tip">{tip}</p>}
    </div>
  );
}
