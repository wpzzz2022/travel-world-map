import type { XhsPost } from "../types";
import Gallery from "./Gallery";

/** 一条关联的小红书笔记：封面 + 标题 + 图集，点击跳原帖 */
export default function XhsPostCard({ post, onDelete }: { post: XhsPost; onDelete: () => void }) {
  const cover = post.images[0];
  return (
    <article className="xhs-card">
      {cover ? (
        <a className="xhs-cover" href={post.url} target="_blank" rel="noopener noreferrer">
          <img src={cover.url} alt={post.title || "小红书笔记封面"} loading="lazy" />
        </a>
      ) : (
        <a className="xhs-cover xhs-cover-empty" href={post.url} target="_blank" rel="noopener noreferrer" aria-hidden="true">
          <span>小红书</span>
        </a>
      )}
      <div className="xhs-main">
        <header className="xhs-head">
          {post.title ? (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="xhs-title">
              {post.title}
            </a>
          ) : (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="xhs-title">
              查看这条笔记 ↗
            </a>
          )}
          <button type="button" className="icon-btn" onClick={onDelete} aria-label="删除这条笔记">
            ✕
          </button>
        </header>
        {post.author && <p className="xhs-author">来自 {post.author} 的笔记</p>}
        {post.note && <p className="xhs-note">{post.note}</p>}
        {post.images.length > 1 && (
          <Gallery
            photos={post.images}
            compact
          />
        )}
        {post.images.length === 0 && (
          <p className="xhs-hint">还没存图：从小红书保存图片后放到 public/xhs/，或在「编辑」里补链接。</p>
        )}
      </div>
    </article>
  );
}
