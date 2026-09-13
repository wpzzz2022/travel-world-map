import { useCallback, useEffect, useRef, useState } from "react";
import Gallery from "./Gallery";
import { isMediaName, photoWithVideoFlag } from "../lib/media";
import { clearDirHandle, loadDirHandle, saveDirHandle, supportsFolderPicker } from "../lib/mediaStore";
import type { Photo } from "../types";

/**
 * 本机相册：把电脑里的一个照片/视频文件夹关联到当前页面。
 * 文件夹句柄存 IndexedDB（Chrome/Edge 的 File System Access API），刷新后仍然有效；
 * 浏览时按需生成 blob URL，不把文件复制进浏览器，视频多大都行。
 */
export default function MediaFolder({
  ownerKey,
  folderName,
  onChangeFolder,
}: {
  /** IndexedDB 里存句柄用的键，例如 adv:<id> / spot:<id> */
  ownerKey: string;
  /** 已关联的文件夹名（存在业务数据里） */
  folderName?: string;
  onChangeFolder?: (name?: string) => void;
}) {
  const [items, setItems] = useState<Photo[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urlsRef = useRef<string[]>([]);

  const revokeAll = () => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  };

  const browse = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const handle = (await loadDirHandle(ownerKey)) as FileSystemDirectoryHandle | undefined;
      if (!handle) {
        setError("找不到已关联的文件夹句柄，请重新关联一次。");
        setItems([]);
        return;
      }
      // 刷新后权限会退回 prompt，需要用户点一次授权
      const perm = await (handle as FileSystemDirectoryHandle & { queryPermission?: (d: { mode: string }) => Promise<PermissionState> }).queryPermission?.({ mode: "read" });
      if (perm !== "granted") {
        const asked = await (handle as FileSystemDirectoryHandle & { requestPermission: (d: { mode: string }) => Promise<PermissionState> }).requestPermission({ mode: "read" });
        if (asked !== "granted") {
          setError("没有读取该文件夹的权限，请重新关联或允许访问。");
          setItems([]);
          return;
        }
      }
      const files: FileSystemFileHandle[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const entry of (handle as any).values()) {
        if (entry.kind === "file" && isMediaName(entry.name)) files.push(entry as FileSystemFileHandle);
      }
      files.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true }));
      const shown = files.slice(0, 500);
      const photos: Photo[] = [];
      for (const f of shown) {
        const file = await f.getFile();
        const url = URL.createObjectURL(file);
        urlsRef.current.push(url);
        photos.push(photoWithVideoFlag(url, f.name, f.name));
      }
      // 先换指针再回收旧的，避免把刚生成的 blob URL 一并回收
      const oldUrls = urlsRef.current;
      urlsRef.current = photos.map((p) => p.url);
      for (const u of oldUrls.slice(urlsRef.current.length, oldUrls.length)) {
        if (!urlsRef.current.includes(u)) URL.revokeObjectURL(u);
      }
      setItems(photos);
      if (files.length > shown.length) {
        setError(`文件夹里有 ${files.length} 个文件，只展示前 500 个。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取文件夹失败");
    } finally {
      setBusy(false);
    }
  }, [ownerKey]);

  useEffect(() => {
    setItems(null);
    setError("");
    if (folderName) void browse();
    return revokeAll;
  }, [browse, folderName]);

  const link = async () => {
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picker = (window as any).showDirectoryPicker as ((opts?: unknown) => Promise<FileSystemDirectoryHandle>) | undefined;
      if (!picker) {
        setError("当前浏览器不支持关联文件夹（需要 Chrome / Edge），可以改用下面的手动添加图片。");
        return;
      }
      const dir = await picker({ mode: "read" });
      await saveDirHandle(ownerKey, dir);
      onChangeFolder?.(dir.name);
    } catch {
      /* 用户取消选择，静默即可 */
    }
  };

  const unlink = async () => {
    await clearDirHandle(ownerKey);
    onChangeFolder?.(undefined);
    setItems(null);
    setError("");
  };

  return (
    <div className="media-folder">
      {folderName ? (
        <div className="media-folder-head">
          <span className="media-folder-name">📁 {folderName}</span>
          <button type="button" className="btn" onClick={() => void browse()} disabled={busy}>
            {busy ? "读取中…" : items ? "重新扫描" : "浏览相册"}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => void unlink()}>
            取消关联
          </button>
        </div>
      ) : (
        <div className="media-folder-head">
          {supportsFolderPicker() ? (
            <button type="button" className="btn" onClick={() => void link()}>
              🔗 关联本机相册文件夹
            </button>
          ) : (
            <span className="quiet-hint">当前浏览器不支持关联文件夹（需要 Chrome / Edge），可以在下面手动添加图片。</span>
          )}
        </div>
      )}

      {folderName && !items && !busy && !error && (
        <p className="quiet-hint">点「浏览相册」读取这个文件夹里的照片和视频（只在本地读取，不会上传）。</p>
      )}
      {error && <p className="form-tip media-folder-error">{error}</p>}

      {items && items.length > 0 && (
        <>
          <Gallery photos={expanded ? items : items.slice(0, 8)} />
          {items.length > 8 && (
            <button type="button" className="btn album-toggle" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "收起相册" : `展开全部 ${items.length} 张`}
            </button>
          )}
          <p className="quiet-hint">{items.length} 个文件 · 点缩略图看大图 / 播放视频</p>
        </>
      )}
      {items && items.length === 0 && !error && <p className="quiet-hint">这个文件夹里没有识别到照片或视频。</p>}
    </div>
  );
}
