import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import LoginModal from "./LoginModal";
import Modal from "./Modal";
import { exportJson, parseImported, useData } from "../lib/store";

/** 右上角：主导航（地图 / 行程 / 冒险）+ 登录态 + 数据菜单（导出 / 导入 / 重置） */
export default function SettingsMenu() {
  const { data, replaceData, session, apiAvailable, setSessionUser, logout } = useData();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = parseImported(await file.text());
      replaceData(next);
      setError("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="topbar">
      <nav className="topnav" aria-label="主导航">
        <NavLink to="/" end className={({ isActive }) => `topnav-link ${isActive ? "topnav-active" : ""}`}>
          🌍 地图
        </NavLink>
        <NavLink to="/plans" className={({ isActive }) => `topnav-link ${isActive ? "topnav-active" : ""}`}>
          🧳 行程
        </NavLink>
        <NavLink to="/adventures" className={({ isActive }) => `topnav-link ${isActive ? "topnav-active" : ""}`}>
          🧭 冒险
        </NavLink>
      </nav>
      {session ? (
        <div className="userchip">
          <span className="userchip-name" title={`已登录：${session}，修改会自动同步到服务器`}>
            👤 {session}
          </span>
          <button type="button" className="btn btn-quiet" onClick={logout} title="退出登录（本机数据保留）">
            退出
          </button>
        </div>
      ) : (
        apiAvailable && (
          <button type="button" className="btn" onClick={() => setLogin(true)} title="登录后记录同步到服务器，换设备不丢">
            登录
          </button>
        )
      )}
      <div className="settings" ref={menuRef}>
        <button type="button" className="btn btn-quiet" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          数据
        </button>
        {open && (
          <div className="settings-menu">
            <button
              type="button"
              onClick={() => {
                exportJson(data);
                setOpen(false);
              }}
            >
              导出全部数据（JSON）
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              导入 JSON…
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("确定丢弃所有修改，恢复到示例数据吗？")) {
                  replaceData({ version: 1, countries: {}, trips: [] });
                  setOpen(false);
                }
              }}
            >
              清空本地数据
            </button>
            <button
              type="button"
              onClick={() => {
                setHelp(true);
                setOpen(false);
              }}
            >
              使用说明
            </button>
            {error && <p className="settings-error">{error}</p>}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </div>
      {login && (
        <LoginModal
          onLoggedIn={(username) => {
            setLogin(false);
            setSessionUser(username);
          }}
          onClose={() => setLogin(false)}
        />
      )}
      {help && (
        <Modal title="使用说明" onClose={() => setHelp(false)} wide>
          <div className="help">
            <h4>数据存在哪里？</h4>
            <p>
              所有内容保存在这台浏览器里（localStorage）。换电脑或换浏览器不会自动同步——点「导出全部数据」存成
              JSON，换设备后再「导入」即可；也可以把导出的文件内容替换 <code>src/data/seed.json</code>，让数据跟着项目走。
            </p>
            <h4>怎么添加内容？</h4>
            <p>
              在地球上点开一个国家 → 添加目的地（城市） → 在目的地里添加景点 →
              景点里可以放介绍、地图选点、打卡点和图片。选坐标时直接在地图上点一下即可。
            </p>
            <h4>中国的城市地图怎么用？</h4>
            <p>
              点开中国，会看到 370 个市级单位的地图和清单：金色是想去、绿色是去过、灰绿是还没去。点任意城市（哪怕还没去过）就能进入城市页标记状态、添加景点。
            </p>
            <h4>旅行计划怎么用？</h4>
            <p>
              顶栏「🧳 旅行计划」里新建一个计划，然后从城市页点「🧳 加入行程」，或在计划里自由添加站点；每站填上天数，用 ↑↓ 调顺序，就组成一条待出行线路。
            </p>
            <h4>冒险记录是什么？</h4>
            <p>
              顶栏「🧭 冒险」里记录每一次「去过」：日期、关联的城市、评分和感想。详情页可以「关联本机相册文件夹」（Chrome/Edge），电脑里的照片和视频会直接在页面里浏览，不会上传；
              小图也可以手动上传。城市页（去过状态）点「🧭 冒险记录」可一键创建。
            </p>
            <h4>小红书笔记怎么关联？</h4>
            <p>
              目前小红书没有开放的官方接口，采用「链接 + 存图」的方式：把笔记分享链接贴到景点的小红书区域；图片用
              XHS-Downloader 等工具下载（或直接长按保存），放进项目的 <code>public/xhs/</code>{" "}
              目录，在添加图片时填 <code>/xhs/文件名.jpg</code> 就会出现在页面里。详见 README。
            </p>
            <h4>图片放哪里？</h4>
            <p>
              推荐把常用图片放到 <code>public/xhs/</code> 用路径引用；小图也可以直接上传（转成 base64
              存在浏览器里，超过 2MB 会被拦下）。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
