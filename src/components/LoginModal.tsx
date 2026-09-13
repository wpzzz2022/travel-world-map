import { useState } from "react";
import Modal from "./Modal";
import { apiLogin, apiRegister } from "../lib/sync";

/** 登录 / 注册弹窗：注册需要一个邀请码（管理员在 Worker 里设置） */
export default function LoginModal({
  onLoggedIn,
  onClose,
}: {
  onLoggedIn: (username: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = mode === "login" ? await apiLogin(username.trim(), password) : await apiRegister(username.trim(), password, code.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "出错了");
      return;
    }
    onLoggedIn(username.trim());
  };

  return (
    <Modal title={mode === "login" ? "登录" : "注册新账号"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          用户名
          <input
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder="2-24 位字母/数字/下划线"
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder={mode === "register" ? "至少 6 位" : "密码"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
          />
        </label>
        {mode === "register" && (
          <label className="field">
            邀请码
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="向站长要邀请码"
              autoComplete="off"
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !username.trim() || !password}>
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </div>
        <p className="form-tip">登录后你的记录会同步到服务器：换设备、换浏览器都能看到同一份数据。</p>
      </form>
    </Modal>
  );
}
