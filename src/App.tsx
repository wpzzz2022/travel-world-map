import { useCallback, useMemo, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
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

export default function App() {
  const [data, setDataState] = useState<TravelData>(loadData);
  const dataRef = useRef(data);
  dataRef.current = data;

  const replaceData = useCallback((next: TravelData) => {
    saveData(next);
    setDataState(next);
  }, []);

  const mutate = useCallback(
    (fn: (draft: TravelData) => void) => {
      const next = structuredClone(dataRef.current);
      fn(next);
      replaceData(next);
    },
    [replaceData],
  );

  const ctx = useMemo(() => ({ data, mutate, replaceData }), [data, mutate, replaceData]);

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
