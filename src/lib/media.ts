import type { Photo } from "../types";

const VIDEO_RE = /\.(mp4|m4v|webm|mov|avi|mkv|ogv|3gp)(\?.*)?$/i;
const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url) || url.startsWith("data:video/");
}

export function isMediaName(name: string): boolean {
  if (name.startsWith(".") || name.startsWith("$") || /^desktop\.ini$/i.test(name) || /^thumbs\.db$/i.test(name)) return false;
  return VIDEO_RE.test(name) || IMAGE_RE.test(name);
}

export function isMediaFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/") || isMediaName(file.name);
}

/** 统一判断一条媒体记录要不要按视频播放 */
export function isVideo(p: Photo): boolean {
  return p.video === true || isVideoUrl(p.url);
}

/** 视频文件名 → blob URL 需要显式标记 video */
export function photoWithVideoFlag(url: string, name: string, caption?: string): Photo {
  return { url, caption, video: VIDEO_RE.test(name) };
}

export function daysBetween(start?: string, end?: string): number | undefined {
  if (!start) return undefined;
  const s = new Date(start).getTime();
  const e = new Date(end || start).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return undefined;
  return Math.round((e - s) / 86400000) + 1;
}

export function formatDate(d?: string): string {
  if (!d) return "";
  return d.replace(/-/g, ".");
}
