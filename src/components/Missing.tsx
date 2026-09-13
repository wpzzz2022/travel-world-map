import { Link } from "react-router-dom";

/** 路由参数找不到对应数据时的兜底页 */
export default function Missing() {
  return (
    <div className="page">
      <p className="empty">
        这条记录不存在，可能已经被删除。<Link to="/">回到地球</Link>。
      </p>
    </div>
  );
}
