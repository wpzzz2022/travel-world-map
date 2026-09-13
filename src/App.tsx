import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { apiGetData, apiLogout, apiMe, apiPutData } from "./lib/sync";
import { DataContext, loadData, saveData } from "./lib/store";
import type { TravelData } from "./types";
import SettingsMenu from "./components/SettingsMenu";
import HomePage from "./pages/HomePage";
import CountryPage from "./pages/CountryPage";
import ChinaPage from "./pages/ChinaPage";
import DestinationPage from "./pages/DestinationPage";
import SpotPage from "./pages/SpotPage";
import PlansPage from "./pages/PlansPage";
import PlanDetailPage from "./pages/PlanDetailPage";
import AdventuresPage from "./pages/AdventuresPage";
import AdventureDetailPage from "./pages/AdventureDetailPage";

const PUSH_DEBOUNCE = 1200;

export default function App() {
  const [data, setDataState] = useState<TravelData>(loadData);
  const dataRef = useRef(data);
  dataRef.current = data;

  const [session, setSessionState] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // 拉取服务器数据覆盖本机时置位，避免覆盖操作本身又触发一次推送
  const suppressPush = useRef(false);
  const pushTimer = useRef<number | undefined>(undefined);
  const hasPending = useRef(false);

  const replaceData = useCallback((next: TravelData) => {
    saveData(next);
    setDataState(next);
    if (!suppressPush.current) schedulePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutate = useCallback(
    (fn: (draft: TravelData) => void) => {
      const next = structuredClone(dataRef.current);
      fn(next);
      replaceData(next);
    },
    [replaceData],
  );

  /** 防抖推送：连续修改只在停顿后上传一次 */
  function schedulePush() {
    if (!sessionRef.current) return;
    hasPending.current = true;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void flushPush(), PUSH_DEBOUNCE);
  }

  async function flushPush() {
    if (!sessionRef.current) return;
    const ok = await apiPutData(dataRef.current);
    hasPending.current = !ok; // 失败保留待同步标记，等下次触发重试
  }

  /** 登录成功：拉服务器数据，和新旧本机数据做一次协调 */
  const setSessionUser = useCallback(
    (username: string) => {
      sessionRef.current = username;
      setSessionState(username);
      void (async () => {
        const server = await apiGetData();
        if (server === "unavailable" || sessionRef.current !== username) return;
        const local = dataRef.current;
        const localEmpty =
          Object.keys(local.countries).length === 0 && !(local.trips && local.trips.length) && !(local.adventures && local.adventures.length);
        if (server == null) {
          // 新账号：把本机现有的内容（可能是示例或导出的备份）搬上去
          if (!localEmpty) {
            suppressPush.current = true;
            await apiPutData(local);
            suppressPush.current = false;
          }
          return;
        }
        if (JSON.stringify(server) === JSON.stringify(local)) return;
        const useServer = window.confirm(
          `账号「${username}」在服务器上已有数据。\n\n` +
            "确定 = 用服务器的数据覆盖本机浏览器\n" +
            "取消 = 把本机浏览器的数据上传到服务器",
        );
        suppressPush.current = true;
        if (useServer) {
          replaceData(server);
        } else {
          await apiPutData(local);
        }
        suppressPush.current = false;
      })();
    },
    [replaceData],
  );

  const logout = useCallback(() => {
    sessionRef.current = null;
    setSessionState(null);
    void apiLogout();
  }, []);

  // 启动时探测后端与会话
  useEffect(() => {
    void (async () => {
      const me = await apiMe();
      setApiAvailable(!me.unavailable);
      if (me.user) setSessionUser(me.user);
    })();
  }, [setSessionUser]);

  // 页面隐藏/关闭前把未推送的修改冲刷上去；失败时定时重试
  useEffect(() => {
    const onHide = () => {
      if (hasPending.current) void flushPush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && onHide());
    const retry = window.setInterval(onHide, 20_000);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(retry);
    };
  }, []);

  const ctx = useMemo(
    () => ({
      data,
      mutate,
      replaceData,
      session,
      apiAvailable,
      setSessionUser,
      logout,
    }),
    [data, mutate, replaceData, session, apiAvailable, setSessionUser, logout],
  );

  return (
    <DataContext.Provider value={ctx}>
      <SettingsMenu />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/country/CN" element={<ChinaPage />} />
        <Route path="/country/:code" element={<CountryPage />} />
        <Route path="/country/:code/dest/:destId" element={<DestinationPage />} />
        <Route path="/country/:code/dest/:destId/spot/:spotId" element={<SpotPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/:planId" element={<PlanDetailPage />} />
        <Route path="/adventures" element={<AdventuresPage />} />
        <Route path="/adventures/:advId" element={<AdventureDetailPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </DataContext.Provider>
  );
}
