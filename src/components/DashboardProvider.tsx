"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildRange, loadDataset, RANGE_PRESETS } from "@/lib/data";
import type { Dataset, DateRange } from "@/lib/types";

type Status = "loading" | "ready" | "error";

interface DashboardState {
  status: Status;
  dataset: Dataset | null;
  error: string | null;
  rangeKey: string;
  range: DateRange | null;
  setRangeKey: (key: string) => void;
  /** Global branch filter. null = the whole group. */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  retry: () => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

const STORAGE_KEY = "dealerpulse.range";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKeyState] = useState<string>("90d");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && RANGE_PRESETS.some((p) => p.key === saved)) setRangeKeyState(saved);
    } catch {
      /* private mode — fall back to the default range */
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    loadDataset(controller.signal)
      .then((ds) => {
        setDataset(ds);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Something went wrong loading the data");
        setStatus("error");
      });
    return () => controller.abort();
  }, [attempt]);

  const setRangeKey = useCallback((key: string) => {
    setRangeKeyState(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
  }, []);

  const range = useMemo(
    () => (dataset ? buildRange(rangeKey, dataset.asOf, dataset.months) : null),
    [dataset, rangeKey],
  );

  const value = useMemo<DashboardState>(
    () => ({
      status,
      dataset,
      error,
      rangeKey,
      range,
      setRangeKey,
      branchId,
      setBranchId,
      retry: () => setAttempt((a) => a + 1),
    }),
    [status, dataset, error, rangeKey, range, setRangeKey, branchId],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

/** Convenience hook for pages that cannot render until data is present. */
export function useReadyDashboard(): { dataset: Dataset; range: DateRange } | null {
  const { dataset, range, status } = useDashboard();
  if (status !== "ready" || !dataset || !range) return null;
  return { dataset, range };
}
