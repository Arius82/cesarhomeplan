import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { DAYS, INITIAL_TASKS, USERS, type DayKey, type UserName, type WeekTasks, type UserTheme, THEMES, ICONS, DEFAULT_USER_SETTINGS, PRESET_COLORS } from "@/lib/initial-tasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MonthlyView, MonthlyPrintSheet, useMonthlyRoutines } from "@/components/monthly/MonthlyView";
import { RoutineActions } from "@/components/monthly/RoutineActions";
import { monthlyForWeek, isDone, type Routine, type WeekMonthlyItem } from "@/lib/monthly";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Undo2,
  Printer,
  Palette,
  Cloud,
  Check,
  RefreshCw,
  WifiOff,
  AlertCircle,
  Pencil,
  Trash2,
  Plus,
  X,
  Calendar,
  CalendarDays,
  Columns2,
  Users,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cesar Home Plan — Tarefas da família" },
      { name: "description", content: "Organize as tarefas semanais e rotinas mensais de cada pessoa da família, com calendário e impressão." },
      { property: "og:title", content: "Cesar Home Plan — Tarefas da família" },
      { property: "og:description", content: "Tarefas semanais e rotinas mensais individuais, com calendário e impressão para a família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Planner />;
}

type AppState = Record<
  UserName,
  {
    week: string;
    tasks: WeekTasks;
    checked: Record<string, boolean>;
    theme: UserTheme;
    icon: string;
    customBgColor: string;
    customTextColor: string;
  }
>;

const STORAGE_KEY = "casa-organizada-v1";
const OFFLINE_QUEUE_KEY = "casa-organizada-offline-queue-v1";

type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error";

type OfflineAction =
  | { type: "add_task"; name: UserName; day: DayKey; text: string }
  | { type: "remove_task"; name: UserName; day: DayKey; idx: number }
  | { type: "toggle_check"; name: UserName; day: DayKey; idx: number }
  | { type: "edit_task"; name: UserName; day: DayKey; idx: number; text: string }
  | { type: "update_meta"; name: UserName; week?: string; icon?: string; bg?: string; text_color?: string; theme?: UserTheme };

function getDayLabel(day: DayKey): string {
  const found = DAYS.find((d) => d.key === day);
  return found ? found.label : day;
}

function readOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue: OfflineAction[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function enqueueOffline(action: OfflineAction) {
  const queue = readOfflineQueue();
  queue.push(action);
  writeOfflineQueue(queue);
}

function clearOfflineQueue() {
  writeOfflineQueue([]);
}

function makeInitialState(): AppState {
  const state = {} as AppState;
  for (const u of USERS) {
    state[u] = {
      week: "",
      tasks: structuredClone(INITIAL_TASKS[u]),
      checked: {},
      theme: DEFAULT_USER_SETTINGS[u].theme,
      icon: DEFAULT_USER_SETTINGS[u].icon,
      customBgColor: DEFAULT_USER_SETTINGS[u].customBgColor,
      customTextColor: DEFAULT_USER_SETTINGS[u].customTextColor,
    };
  }
  return state;
}

function Planner() {
  const [state, setState] = useState<AppState>(makeInitialState);
  const [activeTab, setActiveTab] = useState<UserName | "compare">("Miguel");
  const [compareMode, setCompareMode] = useState<"all" | "split">("all");
  const [splitLeftUser, setSplitLeftUser] = useState<UserName>("Miguel");
  const [splitRightUser, setSplitRightUser] = useState<UserName>("Davi");

  const active: UserName = activeTab === "compare" ? "Miguel" : activeTab;
  const setActive = (u: UserName) => {
    setActiveTab(u);
  };
  const [loaded, setLoaded] = useState(false);
  const [printMode, setPrintMode] = useState<"active" | "all">("active");
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [monthCursor, setMonthCursor] = useState<Date>(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const monthly = useMonthlyRoutines();
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekRef = useMemo(
    () => (today ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + weekOffset * 7) : null),
    [today, weekOffset],
  );
  const weekRange = useMemo(() => {
    if (!weekRef) return "";
    const off = (weekRef.getDay() + 6) % 7;
    const mon = new Date(weekRef.getFullYear(), weekRef.getMonth(), weekRef.getDate() - off);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    const f = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${f(mon)} a ${f(sun)}`;
  }, [weekRef]);
  const weekMonthly = useMemo(
    () => (weekRef ? monthlyForWeek(monthly.routines, active, weekRef) : [[], [], [], [], [], []]),
    [monthly.routines, active, weekRef],
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const skipNextRealtime = useRef<Record<string, number>>({});

  // Undo stack: snapshots of per-user state taken BEFORE each mutating action
  type HistoryEntry = { user: UserName; label: string; snapshot: AppState[UserName] };
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const MAX_HISTORY = 50;

  // Sync status + offline retry
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const isOnline = useRef<boolean>(navigator.onLine);
  const pendingCount = useRef<number>(0);
  const lastSyncToast = useRef<number>(0);
  const syncStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowToUser = (row: any): AppState[UserName] => ({
    week: row.week ?? "",
    tasks: row.tasks ?? structuredClone(INITIAL_TASKS[row.name as UserName]),
    checked: row.checked ?? {},
    theme: row.theme ?? DEFAULT_USER_SETTINGS[row.name as UserName].theme,
    icon: row.icon ?? DEFAULT_USER_SETTINGS[row.name as UserName].icon,
    customBgColor: row.custom_bg_color ?? DEFAULT_USER_SETTINGS[row.name as UserName].customBgColor,
    customTextColor: row.custom_text_color ?? DEFAULT_USER_SETTINGS[row.name as UserName].customTextColor,
  });

  const userToRow = (name: UserName, s: AppState[UserName]) => ({
    name,
    week: s.week,
    tasks: s.tasks,
    checked: s.checked,
    theme: s.theme,
    icon: s.icon,
    custom_bg_color: s.customBgColor,
    custom_text_color: s.customTextColor,
    updated_at: new Date().toISOString(),
  });

  // ---------- Sync helpers ----------
  const setStableSyncStatus = useCallback((status: SyncStatus) => {
    if (syncStatusTimer.current) clearTimeout(syncStatusTimer.current);
    if (status === "saved") {
      setSyncStatus("saved");
      syncStatusTimer.current = setTimeout(() => setSyncStatus("idle"), 2000);
    } else {
      setSyncStatus(status);
    }
  }, []);

  const trackRpc = useCallback(
    async (
      promise: PromiseLike<any>,
      action: OfflineAction,
      successMessage?: string,
      options?: { silent?: boolean }
    ) => {
      pendingCount.current += 1;
      setStableSyncStatus("saving");
      try {
        const result = await promise;
        if (result?.error) throw result.error;
        setLastSavedAt(new Date());
        setStableSyncStatus("saved");
        if (successMessage && !options?.silent) {
          toast.success(successMessage);
        }
        return result;
      } catch (err: any) {
        if (!navigator.onLine) {
          setStableSyncStatus("offline");
          enqueueOffline(action);
          toast.error("Você está offline. A alteração foi salva localmente e será enviada quando a internet voltar.");
        } else {
          setStableSyncStatus("error");
          enqueueOffline(action);
          toast.error("Falha ao salvar na nuvem. Tentaremos enviar novamente automaticamente.");
        }
        throw err;
      } finally {
        pendingCount.current = Math.max(0, pendingCount.current - 1);
        if (pendingCount.current === 0 && syncStatus !== "offline" && syncStatus !== "error") {
          // keep status set by inner logic (saved or idle)
        }
      }
    },
    [setStableSyncStatus]
  );

  const showSyncStatus = () => {
    const now = Date.now();
    if (now - lastSyncToast.current < 3000) return;
    lastSyncToast.current = now;
    if (syncStatus === "offline") {
      toast.info("Você está offline. Alterações estão guardadas e serão sincronizadas automaticamente.");
    } else if (syncStatus === "error") {
      toast.error("Houve um problema de sincronização. Verifique a internet.");
    } else if (lastSavedAt) {
      toast.success(`Sincronizado ${lastSavedAt.toLocaleTimeString()}`, { id: "sync-status" });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadFromCloud = async () => {
      try {
        const { data, error } = await supabase.from("user_planner").select("*");
        if (error) throw error;

        const cloudByName: Record<string, any> = {};
        (data || []).forEach((row: any) => { cloudByName[row.name] = row; });

        // Seed missing users from initial state
        const seeded: AppState = makeInitialState();
        const toInsert: any[] = [];
        for (const u of USERS) {
          if (cloudByName[u]) {
            seeded[u] = rowToUser(cloudByName[u]);
          } else {
            toInsert.push(userToRow(u, seeded[u]));
          }
        }
        if (toInsert.length > 0) {
          await supabase.from("user_planner").insert(toInsert);
        }
        if (!cancelled) {
          setState(seeded);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        }
      } catch (err) {
        console.error("Failed to load from cloud, using local cache:", err);
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          try {
            const parsed = JSON.parse(raw);
            const fallback = makeInitialState();
            for (const u of USERS) {
              if (parsed[u]) {
                fallback[u] = { ...fallback[u], ...parsed[u] };
              }
            }
            setState(fallback);
          } catch {}
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadFromCloud();

    const channel = supabase
      .channel("user_planner_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_planner" },
        (payload: any) => {
          const row = payload.new;
          if (!row || !USERS.includes(row.name)) return;
          const updatedTs = new Date(row.updated_at).getTime();
          if (skipNextRealtime.current[row.name] === updatedTs) {
            delete skipNextRealtime.current[row.name];
            return;
          }
          setState((prev) => {
            const next = { ...prev, [row.name as UserName]: rowToUser(row) };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true;
      setStableSyncStatus("idle");
      toast.success("Internet de volta! Sincronizando alterações pendentes...");
      void retryOfflineQueue();
    };

    const handleOffline = () => {
      isOnline.current = false;
      setStableSyncStatus("offline");
      toast.info("Você ficou offline. As alterações continuarão funcionando localmente.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      setStableSyncStatus("offline");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setStableSyncStatus]);

  // Retry offline queue
  const retryOfflineQueue = useCallback(async () => {
    const queue = readOfflineQueue();
    if (queue.length === 0) return;
    const remaining: OfflineAction[] = [];
    setStableSyncStatus("saving");
    for (const action of queue) {
      try {
        await dispatchOfflineAction(action);
      } catch {
        remaining.push(action);
      }
    }
    writeOfflineQueue(remaining);
    if (remaining.length > 0) {
      setStableSyncStatus("error");
      toast.error("Algumas alterações ainda não foram sincronizadas. Tentaremos novamente.");
    } else {
      setLastSavedAt(new Date());
      setStableSyncStatus("saved");
      toast.success("Todas as alterações foram sincronizadas!");
    }
  }, [setStableSyncStatus]);

  async function dispatchOfflineAction(action: OfflineAction) {
    switch (action.type) {
      case "add_task":
        return supabase.rpc("planner_add_task", { p_name: action.name, p_day: action.day, p_text: action.text });
      case "remove_task":
        return supabase.rpc("planner_remove_task", { p_name: action.name, p_day: action.day, p_idx: action.idx });
      case "toggle_check":
        return supabase.rpc("planner_toggle_check", { p_name: action.name, p_day: action.day, p_idx: action.idx });
      case "edit_task":
        return supabase.rpc("planner_edit_task", { p_name: action.name, p_day: action.day, p_idx: action.idx, p_text: action.text });
      case "update_meta":
        return supabase.rpc("planner_update_meta", {
          p_name: action.name,
          p_week: action.week,
          p_icon: action.icon,
          p_bg_color: action.bg,
          p_text_color: action.text_color,
          p_theme: action.theme,
        });
    }
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  }, []);

  const showIOSNotification = useMemo(() => {
    if (typeof window === "undefined") return false;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    return isIOS && !isStandalone;
  }, [isIOS]);

  const user = state[active];

  // Optimistic local update only — server is mutated via atomic RPCs below
  const applyLocal = (u: UserName, fn: (s: AppState[UserName]) => AppState[UserName]) => {
    setState((prev) => {
      const next = { ...prev, [u]: fn(prev[u]) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pushHistory = (u: UserName, label: string) => {
    setHistory((h) => {
      const snap = structuredClone(state[u]);
      const next = [...h, { user: u, label, snapshot: snap }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const entry = h[h.length - 1];
      // Restore local state
      applyLocal(entry.user, () => entry.snapshot);
      // Persist full row to cloud (overwrite). Acceptable for an explicit undo.
      void trackRpc(
        supabase.from("user_planner").upsert(userToRow(entry.user, entry.snapshot), { onConflict: "name" }),
        { type: "update_meta", name: entry.user, week: entry.snapshot.week, icon: entry.snapshot.icon, bg: entry.snapshot.customBgColor, text_color: entry.snapshot.customTextColor, theme: entry.snapshot.theme },
        "Ação desfeita"
      );
      // Switch to that user so the change is visible
      setActive(entry.user);
      return h.slice(0, -1);
    });
  };

  const [pendingRemove, setPendingRemove] = useState<{ day: DayKey; idx: number; text: string; targetUser: UserName } | null>(null);

  const addTask = (day: DayKey, text: string, targetUser: UserName = active) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushHistory(targetUser, `Adicionar tarefa em ${getDayLabel(day)}`);
    applyLocal(targetUser, (s) => ({ ...s, tasks: { ...s.tasks, [day]: [...s.tasks[day], trimmed] } }));
    void trackRpc(
      supabase.rpc("planner_add_task", { p_name: targetUser, p_day: day, p_text: trimmed }),
      { type: "add_task", name: targetUser, day, text: trimmed },
      "Tarefa adicionada"
    );
  };

  const removeTask = (day: DayKey, idx: number, targetUser: UserName = active) => {
    const taskText = state[targetUser].tasks[day][idx] || "";
    setPendingRemove({ day, idx, text: taskText, targetUser });
  };

  const confirmRemoveTask = () => {
    if (!pendingRemove) return;
    const { day, idx, targetUser } = pendingRemove;
    pushHistory(targetUser, `Remover tarefa de ${getDayLabel(day)}`);
    applyLocal(targetUser, (s) => {
      const tasks = { ...s.tasks, [day]: s.tasks[day].filter((_, i) => i !== idx) };
      const newChecked = {} as Record<string, boolean>;
      Object.entries(s.checked).forEach(([k, val]) => {
        const [dKey, iStr] = k.split("-");
        if (dKey === day) {
          const index = parseInt(iStr, 10);
          if (index < idx) newChecked[k] = val;
          else if (index > idx) newChecked[`${dKey}-${index - 1}`] = val;
        } else {
          newChecked[k] = val;
        }
      });
      return { ...s, tasks, checked: newChecked };
    });
    void trackRpc(
      supabase.rpc("planner_remove_task", { p_name: targetUser, p_day: day, p_idx: idx }),
      { type: "remove_task", name: targetUser, day, idx },
      "Tarefa removida"
    );
    setPendingRemove(null);
  };

  const toggleCheck = (day: DayKey, idx: number, targetUser: UserName = active) => {
    const key = `${day}-${idx}`;
    pushHistory(targetUser, `Marcar/desmarcar em ${getDayLabel(day)}`);
    applyLocal(targetUser, (s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
    void trackRpc(
      supabase.rpc("planner_toggle_check", { p_name: targetUser, p_day: day, p_idx: idx }),
      { type: "toggle_check", name: targetUser, day, idx },
      undefined,
      { silent: true }
    );
  };

  const editTask = (day: DayKey, idx: number, text: string, targetUser: UserName = active) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushHistory(targetUser, `Editar tarefa em ${getDayLabel(day)}`);
    applyLocal(targetUser, (s) => {
      const tasks = { ...s.tasks };
      tasks[day] = tasks[day].map((t, i) => (i === idx ? trimmed : t));
      return { ...s, tasks };
    });
    void trackRpc(
      supabase.rpc("planner_edit_task", { p_name: targetUser, p_day: day, p_idx: idx, p_text: trimmed }),
      { type: "edit_task", name: targetUser, day, idx, text: trimmed },
      "Tarefa atualizada"
    );
  };

  // Debounce week-text RPC to coalesce typing into one update
  const weekDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setWeek = (week: string) => {
    applyLocal(active, (s) => ({ ...s, week }));
    const u = active;
    if (weekDebounce.current[u]) clearTimeout(weekDebounce.current[u]);
    weekDebounce.current[u] = setTimeout(() => {
      void trackRpc(
        supabase.rpc("planner_update_meta", { p_name: u, p_week: week }),
        { type: "update_meta", name: u, week },
        undefined,
        { silent: true }
      );
    }, 400);
  };

  const setIcon = (icon: string) => {
    applyLocal(active, (s) => ({ ...s, icon }));
    void trackRpc(
      supabase.rpc("planner_update_meta", { p_name: active, p_icon: icon }),
      { type: "update_meta", name: active, icon },
      "Ícone atualizado"
    );
  };

  const setCustomBgColor = (color: string) => {
    applyLocal(active, (s) => ({ ...s, customBgColor: color }));
    void trackRpc(
      supabase.rpc("planner_update_meta", { p_name: active, p_bg: color }),
      { type: "update_meta", name: active, bg: color },
      undefined,
      { silent: true }
    );
  };

  const setCustomTextColor = (color: string) => {
    applyLocal(active, (s) => ({ ...s, customTextColor: color }));
    void trackRpc(
      supabase.rpc("planner_update_meta", { p_name: active, p_text_color: color }),
      { type: "update_meta", name: active, text_color: color },
      undefined,
      { silent: true }
    );
  };

  const applyThemePreset = (themeKey: UserTheme) => {
    const bg = PRESET_COLORS[themeKey].bg;
    const textColor = PRESET_COLORS[themeKey].text;
    applyLocal(active, (s) => ({ ...s, theme: themeKey, customBgColor: bg, customTextColor: textColor }));
    void trackRpc(
      supabase.rpc("planner_update_meta", { p_name: active, p_theme: themeKey, p_bg: bg, p_text_color: textColor }),
      { type: "update_meta", name: active, theme: themeKey, bg, text_color: textColor },
      "Tema aplicado"
    );
  };

  const handlePrintActive = () => {
    setPrintMode("active");
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintAll = () => {
    setPrintMode("all");
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className={`min-h-screen bg-background text-foreground print-mode-${printMode}`}>
      <div className="no-print mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shadow-xs"
              style={{ backgroundColor: user.customTextColor }}
            >
              {active.charAt(0)}
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Cesar Home Plan</h1>
              <p className="text-xs text-muted-foreground">Cronograma familiar de tarefas e rotinas</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              title={history.length > 0 ? `Desfazer: ${history[history.length - 1].label} (${history[history.length - 1].user})` : "Nada para desfazer"}
              className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Desfazer{history.length > 0 ? ` (${history.length})` : ""}</span>
            </button>
            <button
              onClick={() => setIsCustomizeOpen(true)}
              className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Aparência</span>
            </button>
            <button
              onClick={handlePrintActive}
              className="rounded-lg bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs hover:bg-primary/95 cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handlePrintAll}
              className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 shadow-xs cursor-pointer hidden md:flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Todas (4 págs.)</span>
            </button>

            <SyncStatusChip status={syncStatus} lastSavedAt={lastSavedAt} onClick={showSyncStatus} />
          </div>
        </header>

        {/* User Navigation Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
          {USERS.map((u) => {
            const uConfig = state[u];
            const isSelected = activeTab === u;
            return (
              <button
                key={u}
                onClick={() => setActiveTab(u)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: uConfig.customTextColor }}
                >
                  {u.charAt(0)}
                </span>
                <span>{u}</span>
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab("compare")}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "compare"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Columns2 className="w-4 h-4" />
            <span>Comparar</span>
          </button>
        </div>

        {/* PWA Installation Banner (no-print) */}
        {(showInstallBanner || showIOSNotification) && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-in fade-in duration-350 text-foreground">
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Instale o Cesar Home Plan no seu aparelho!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showIOSNotification ? (
                    "Toque no botão de compartilhar do Safari e selecione 'Adicionar à Tela de Início'."
                  ) : (
                    "Acesso rápido na tela inicial, suporte offline e experiência completa em tela cheia."
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => {
                  setShowInstallBanner(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold opacity-70 hover:opacity-100 hover:bg-background/30 rounded-md transition-all cursor-pointer"
              >
                Agora não
              </button>
              {!showIOSNotification && (
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-1.5 text-xs font-bold rounded-md shadow-xs bg-primary text-primary-foreground transition-all hover:bg-primary/95 cursor-pointer"
                >
                  Instalar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Personalizar Dialog */}
        <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Palette className="h-4 w-4 text-primary" />
                Personalizar Cronograma
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajuste a semana de referência e as cores dos dias para {active}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2 text-foreground">
              {/* Semana */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Semana de Referência:</label>
                <input
                  value={user.week}
                  onChange={(e) => setWeek(e.target.value)}
                  placeholder="ex: 23/06 a 28/06"
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Cores dos Cabeçalhos */}
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground">Cores dos Cabeçalhos dos Dias:</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between border border-border rounded-lg p-2.5 bg-muted/20">
                    <span className="text-xs font-medium">Cor de Fundo:</span>
                    <input
                      type="color"
                      value={user.customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    />
                  </div>
                  <div className="flex items-center justify-between border border-border rounded-lg p-2.5 bg-muted/20">
                    <span className="text-xs font-medium">Cor da Letra:</span>
                    <input
                      type="color"
                      value={user.customTextColor}
                      onChange={(e) => setCustomTextColor(e.target.value)}
                      className="h-7 w-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div
                  className="mt-1 p-2.5 text-center text-xs font-bold rounded-lg border tracking-wider"
                  style={{
                    backgroundColor: user.customBgColor,
                    color: user.customTextColor,
                    borderColor: `${user.customTextColor}40`,
                  }}
                >
                  PRÉ-VISUALIZAÇÃO DO DIA
                </div>
              </div>

              {/* Predefinições Rápidas */}
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground">Predefinições Rápidas:</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(THEMES).map(([key, cfg]) => {
                    const themeKey = key as UserTheme;
                    const dotColors: Record<UserTheme, string> = {
                      blue: "bg-blue-500",
                      emerald: "bg-emerald-500",
                      amber: "bg-amber-500",
                      pink: "bg-pink-500",
                      slate: "bg-slate-500",
                    };
                    return (
                      <button
                        key={themeKey}
                        onClick={() => applyThemePreset(themeKey)}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors cursor-pointer"
                      >
                        <span className={`h-2 w-2 rounded-full ${dotColors[themeKey] || "bg-primary"}`} />
                        <span>{cfg.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comparison Bar (visible only in compare tab) */}
        {activeTab === "compare" && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col gap-3 text-foreground">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modo:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCompareMode("all")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                      compareMode === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Visão Geral (Todos)</span>
                  </button>
                  <button
                    onClick={() => setCompareMode("split")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                      compareMode === "split"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>Lado a Lado</span>
                  </button>
                </div>
              </div>

              {compareMode === "split" && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Esquerda:</span>
                    <select
                      value={splitLeftUser}
                      onChange={(e) => setSplitLeftUser(e.target.value as UserName)}
                      className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {USERS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Direita:</span>
                    <select
                      value={splitRightUser}
                      onChange={(e) => setSplitRightUser(e.target.value as UserName)}
                      className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {USERS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Days Grid or Comparative Grid */}
        {activeTab === "compare" ? (
          compareMode === "all" ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {DAYS.map((d) => (
                <AllUsersDayCard
                  key={d.key}
                  day={d.key}
                  label={d.label}
                  state={state}
                  onToggle={toggleCheck}
                  onAdd={addTask}
                  onRemove={removeTask}
                  onEdit={editTask}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-xs"
                    style={{ backgroundColor: state[splitLeftUser].customTextColor }}
                  >
                    {splitLeftUser.charAt(0)}
                  </span>
                  <h2 className="text-lg font-bold" style={{ color: state[splitLeftUser].customTextColor }}>
                    Cronograma de {splitLeftUser}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  {DAYS.map((d) => (
                    <DayCard
                      key={`left-${d.key}`}
                      day={d.key}
                      label={d.label}
                      tasks={state[splitLeftUser].tasks[d.key]}
                      checked={state[splitLeftUser].checked}
                      onToggle={(day, idx) => toggleCheck(day, idx, splitLeftUser)}
                      onAdd={(day, text) => addTask(day, text, splitLeftUser)}
                      onRemove={(day, idx) => removeTask(day, idx, splitLeftUser)}
                      onEdit={(day, idx, text) => editTask(day, idx, text, splitLeftUser)}
                      customBgColor={state[splitLeftUser].customBgColor}
                      customTextColor={state[splitLeftUser].customTextColor}
                    />
                  ))}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-xs"
                    style={{ backgroundColor: state[splitRightUser].customTextColor }}
                  >
                    {splitRightUser.charAt(0)}
                  </span>
                  <h2 className="text-lg font-bold" style={{ color: state[splitRightUser].customTextColor }}>
                    Cronograma de {splitRightUser}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  {DAYS.map((d) => (
                    <DayCard
                      key={`right-${d.key}`}
                      day={d.key}
                      label={d.label}
                      tasks={state[splitRightUser].tasks[d.key]}
                      checked={state[splitRightUser].checked}
                      onToggle={(day, idx) => toggleCheck(day, idx, splitRightUser)}
                      onAdd={(day, text) => addTask(day, text, splitRightUser)}
                      onRemove={(day, idx) => removeTask(day, idx, splitRightUser)}
                      onEdit={(day, idx, text) => editTask(day, idx, text, splitRightUser)}
                      customBgColor={state[splitRightUser].customBgColor}
                      customTextColor={state[splitRightUser].customTextColor}
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <>
          <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
            {(["weekly", "monthly"] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${viewMode === m ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "weekly" ? <CalendarDays className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>{m === "weekly" ? "Semanal" : "Mensal"}</span>
              </button>
            ))}
          </div>
          {viewMode === "monthly" ? (
            <MonthlyView user={active} cursor={monthCursor} setCursor={setMonthCursor} api={monthly}
              customBgColor={user.customBgColor} customTextColor={user.customTextColor} />
          ) : (
          <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)}
              className="h-8 w-8 rounded-lg border border-border font-bold cursor-pointer hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-xs font-semibold">Semana {weekRange}</span>
            <button aria-label="Próxima semana" onClick={() => setWeekOffset((w) => w + 1)}
              className="h-8 w-8 rounded-lg border border-border font-bold cursor-pointer hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}
              className="h-8 px-2.5 rounded-lg border border-border text-xs font-medium cursor-pointer hover:bg-muted disabled:opacity-40 disabled:cursor-default">
              Semana atual
            </button>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DAYS.map((d, di) => (
              <DayCard
                key={d.key}
                day={d.key}
                label={d.label}
                monthlyItems={weekMonthly[di]}
                onToggleMonthly={(it) => monthly.toggle(it.routine, it.date)}
                onUpdateMonthly={monthly.update}
                onRemoveMonthly={monthly.remove}
                tasks={user.tasks[d.key]}
                checked={user.checked}
                onToggle={(day, idx) => toggleCheck(day, idx, active)}
                onAdd={(day, text) => addTask(day, text, active)}
                onRemove={(day, idx) => removeTask(day, idx, active)}
                onEdit={(day, idx, text) => editTask(day, idx, text, active)}
                customBgColor={user.customBgColor}
                customTextColor={user.customTextColor}
              />
            ))}
          </div>
          </>
          )}
          </>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
          <AlertDialogContent className="no-print">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover a tarefa "{pendingRemove?.text}" de {pendingRemove ? getDayLabel(pendingRemove.day) : ""}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRemove(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Printable Containers (Always rendered but toggle class hides/shows during printing) */}
      <div className="print-active-sheet">
        {viewMode === "monthly" && activeTab !== "compare" ? (
          <MonthlyPrintSheet user={active} icon={user.icon} cursor={monthCursor} routines={monthly.routines}
            customBgColor={user.customBgColor} customTextColor={user.customTextColor} />
        ) : (
        <PrintSheet
          user={active}
          week={user.week}
          tasks={user.tasks}
          customBgColor={user.customBgColor}
          customTextColor={user.customTextColor}
          icon={user.icon}
        />
        )}
      </div>

      <div className="print-all-sheets">
        {USERS.map((u) => {
          const uConfig = state[u];
          return (
            <div key={u} className="print-page-break">
              {viewMode === "monthly" && activeTab !== "compare" ? (
                <MonthlyPrintSheet user={u} icon={uConfig.icon} cursor={monthCursor} routines={monthly.routines}
                  customBgColor={uConfig.customBgColor} customTextColor={uConfig.customTextColor} />
              ) : (
              <PrintSheet
                user={u}
                week={uConfig.week}
                tasks={uConfig.tasks}
                customBgColor={uConfig.customBgColor}
                customTextColor={uConfig.customTextColor}
                icon={uConfig.icon}
              />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SyncStatusChip({
  status,
  lastSavedAt,
  onClick,
}: {
  status: SyncStatus;
  lastSavedAt: Date | null;
  onClick: () => void;
}) {
  const config: Record<SyncStatus, { label: string; icon: React.ReactNode; color: string }> = {
    idle: { label: "Sincronizado", icon: <Cloud className="w-3.5 h-3.5 text-emerald-600" />, color: "text-emerald-700 bg-emerald-50/70 border-emerald-200" },
    saving: { label: "Salvando...", icon: <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />, color: "text-amber-700 bg-amber-50/70 border-amber-200" },
    saved: { label: "Salvo", icon: <Check className="w-3.5 h-3.5 text-emerald-600" />, color: "text-emerald-700 bg-emerald-50/70 border-emerald-200" },
    offline: { label: "Offline", icon: <WifiOff className="w-3.5 h-3.5 text-slate-500" />, color: "text-slate-600 bg-slate-100 border-slate-300" },
    error: { label: "Erro de sinc.", icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />, color: "text-rose-700 bg-rose-50/70 border-rose-200" },
  };
  const { label, icon, color } = config[status];
  return (
    <button
      onClick={onClick}
      title={lastSavedAt ? `Última sincronização: ${lastSavedAt.toLocaleTimeString()}` : "Clique para ver o status de sincronização"}
      className={`ml-1 hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:opacity-80 cursor-pointer ${color}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TaskItem({
  day,
  idx,
  text,
  isChecked,
  customTextColor,
  onToggle,
  onRemove,
  onEdit,
}: {
  day: DayKey;
  idx: number;
  text: string;
  isChecked: boolean;
  customTextColor: string;
  onToggle: (d: DayKey, i: number) => void;
  onRemove: (d: DayKey, i: number) => void;
  onEdit: (d: DayKey, i: number, t: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editText.trim() && editText.trim() !== text) {
      onEdit(day, idx, editText.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-1.5 w-full py-0.5">
        <input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
          autoFocus
        />
        <button
          type="submit"
          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer transition-colors"
          title="Salvar"
          aria-label="Salvar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditText(text);
            setIsEditing(false);
          }}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors"
          title="Cancelar"
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <li className="flex items-center gap-2.5 text-sm group min-h-[32px] py-1 border-b border-border/20 last:border-b-0">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(day, idx)}
        className="h-4 w-4 shrink-0 rounded cursor-pointer accent-primary"
      />
      <span className={`flex-1 transition-all ${isChecked ? "opacity-40 line-through" : "font-medium text-foreground"}`}>
        {text}
      </span>
      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted cursor-pointer transition-colors"
          title="Editar tarefa"
          aria-label="Editar tarefa"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(day, idx)}
          className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 cursor-pointer transition-colors"
          title="Excluir tarefa"
          aria-label="Excluir tarefa"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

function DayCard({
  day,
  label,
  tasks,
  checked,
  onToggle,
  onAdd,
  onRemove,
  onEdit,
  customBgColor,
  customTextColor,
  monthlyItems = [],
  onToggleMonthly,
  onUpdateMonthly,
  onRemoveMonthly,
}: {
  monthlyItems?: WeekMonthlyItem[];
  onToggleMonthly?: (it: WeekMonthlyItem) => void;
  onUpdateMonthly?: (id: string, patch: Partial<Routine>) => Promise<boolean>;
  onRemoveMonthly?: (id: string) => Promise<boolean>;
  day: DayKey;
  label: string;
  tasks: string[];
  checked: Record<string, boolean>;
  onToggle: (d: DayKey, i: number) => void;
  onAdd: (d: DayKey, t: string) => void;
  onRemove: (d: DayKey, i: number) => void;
  onEdit: (d: DayKey, i: number, t: string) => void;
  customBgColor: string;
  customTextColor: string;
}) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 text-card-foreground">
      {/* Only the header has custom background and text color */}
      <h3 
        style={{
          backgroundColor: customBgColor,
          color: customTextColor,
          borderColor: `${customTextColor}30`
        }}
        className="mb-4 -mx-5 -mt-5 p-3 text-center text-sm font-extrabold tracking-wider rounded-t-xl border-b"
      >
        {label}
      </h3>
      <ul className="space-y-3 min-h-[140px]">
        {tasks.map((t, i) => {
          const key = `${day}-${i}`;
          const isChecked = !!checked[key];
          return (
            <TaskItem
              key={key}
              day={day}
              idx={i}
              text={t}
              isChecked={isChecked}
              customTextColor={customTextColor}
              onToggle={onToggle}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          );
        })}
        {monthlyItems.map((it) => {
          const done = isDone(it.routine, it.date);
          return (
            <li key={`m-${it.routine.id}`} className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5">
              <input
                type="checkbox"
                checked={done}
                onChange={() => onToggleMonthly?.(it)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                aria-label={`Concluir rotina mensal ${it.routine.title}`}
              />
              <span className={`min-w-0 flex-1 break-words text-sm italic ${done ? "line-through opacity-50" : ""}`}>
                {it.routine.title}
                <span className="ml-1.5 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold not-italic text-secondary-foreground align-middle">
                  📅 Mensal{it.isSunday ? " · domingo" : ""} {String(it.date.getDate()).padStart(2, "0")}/{String(it.date.getMonth() + 1).padStart(2, "0")}
                </span>
              </span>
              {onUpdateMonthly && onRemoveMonthly && <RoutineActions routine={it.routine} date={it.date} onUpdate={onUpdateMonthly} onRemove={onRemoveMonthly} />}
            </li>
          );
        })}
        {tasks.length === 0 && monthlyItems.length === 0 && (
          <li className="text-xs opacity-50 italic flex items-center justify-center h-20">
            Nenhuma tarefa cadastrada
          </li>
        )}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(day, text);
          setText("");
        }}
        className="mt-4 flex gap-1.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground/50 text-foreground"
        />
        <button
          type="submit"
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold shadow-xs transition-all active:scale-95 hover:bg-primary/90 cursor-pointer flex items-center justify-center"
          title="Adicionar tarefa"
          aria-label="Adicionar tarefa"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function AllUsersDayCard({
  day,
  label,
  state,
  onToggle,
  onAdd,
  onRemove,
  onEdit,
}: {
  day: DayKey;
  label: string;
  state: AppState;
  onToggle: (d: DayKey, i: number, u: UserName) => void;
  onAdd: (d: DayKey, t: string, u: UserName) => void;
  onRemove: (d: DayKey, i: number, u: UserName) => void;
  onEdit: (d: DayKey, i: number, t: string, u: UserName) => void;
}) {
  const [text, setText] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserName>("Miguel");

  const totalTasks = USERS.reduce((acc, u) => acc + (state[u].tasks[day]?.length || 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 text-card-foreground flex flex-col justify-between min-h-[300px]">
      <div>
        <h3 className="mb-4 -mx-5 -mt-5 p-3 text-center text-sm font-extrabold tracking-wider rounded-t-xl border-b bg-secondary text-secondary-foreground">
          {label}
        </h3>

        <div className="space-y-4 mb-4">
          {USERS.map((u) => {
            const userTasks = state[u].tasks[day] || [];
            if (userTasks.length === 0) return null;
            return (
              <div key={u} className="border-b border-border/10 pb-3 last:border-b-0 last:pb-0">
                <div 
                  className="flex items-center gap-1.5 text-xs font-bold mb-2 px-2 py-0.5 rounded-md w-fit border"
                  style={{
                    backgroundColor: `${state[u].customBgColor}15`,
                    color: state[u].customTextColor,
                    borderColor: `${state[u].customTextColor}30`
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: state[u].customTextColor }}
                  >
                    {u.charAt(0)}
                  </span>
                  <span>{u}</span>
                </div>
                <ul className="space-y-2">
                  {userTasks.map((t, i) => {
                    const key = `${day}-${i}`;
                    const isChecked = !!state[u].checked[key];
                    return (
                      <TaskItem
                        key={`${u}-${key}`}
                        day={day}
                        idx={i}
                        text={t}
                        isChecked={isChecked}
                        customTextColor={state[u].customTextColor}
                        onToggle={(d, idx) => onToggle(d, idx, u)}
                        onRemove={(d, idx) => onRemove(d, idx, u)}
                        onEdit={(d, idx, txt) => onEdit(d, idx, txt, u)}
                      />
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {totalTasks === 0 && (
            <div className="text-xs opacity-50 italic flex items-center justify-center h-28">
              Nenhuma tarefa cadastrada
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(day, text, selectedUser);
          setText("");
        }}
        className="mt-auto pt-3 border-t border-border/30 flex flex-col gap-2"
      >
        <div className="flex gap-1.5 items-center">
          <span className="text-xs font-semibold text-muted-foreground">Para:</span>
          <div className="flex flex-wrap gap-1 flex-1">
            {USERS.map((u) => {
              const isSel = selectedUser === u;
              return (
                <button
                  type="button"
                  key={u}
                  onClick={() => setSelectedUser(u)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isSel
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: state[u].customTextColor }}
                  >
                    {u.charAt(0)}
                  </span>
                  <span>{u}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Adicionar tarefa..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground/50 text-foreground"
          />
          <button
            type="submit"
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold shadow-xs transition-all active:scale-95 hover:bg-primary/90 cursor-pointer flex items-center justify-center"
            title="Adicionar tarefa"
            aria-label="Adicionar tarefa"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function PrintSheet({
  user,
  week,
  tasks,
  customBgColor,
  customTextColor,
  icon,
}: {
  user: UserName;
  week: string;
  tasks: WeekTasks;
  customBgColor: string;
  customTextColor: string;
  icon: string;
}) {
  return (
    <div className="print-sheet-content" style={{
      padding: "5mm",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#0f172a",
      backgroundColor: "#ffffff",
      border: `2.5px solid #1e293b`,
      borderRadius: "12px",
      height: "185mm",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxSizing: "border-box",
      pageBreakInside: "avoid"
    }}>
      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: customTextColor,
                color: "#ffffff",
                fontSize: "16pt",
                fontWeight: "900",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}
            >
              {user.charAt(0)}
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "18pt", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e293b" }}>
                {user}
              </span>
              <span style={{ fontSize: "8.5pt", color: "#64748b", fontWeight: "600" }}>
                Cronograma de Tarefas Semanais
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12pt", fontWeight: "800", color: "#1e293b" }}>
              Uma casa organizada é uma casa feliz
            </div>
            <div style={{ fontSize: "9.5pt", color: "#0f172a", marginTop: "3px", fontWeight: "600" }}>
              Semana: <span style={{ borderBottom: `1.5px solid #1e293b`, paddingBottom: "1px", minWidth: "120px", display: "inline-block", textAlign: "center" }}>{week || "________________"}</span>
            </div>
          </div>
        </div>

        {/* Table/Grid */}
        <table style={{ width: "100%", height: "140mm", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <tbody>
            {[0, 3].map((rowStart) => (
              <tr key={rowStart}>
                {DAYS.slice(rowStart, rowStart + 3).map((d) => {
                  const dayTasks = tasks[d.key];
                  const displayTasks = [...dayTasks];
                  const minTasks = 7;
                  while (displayTasks.length < minTasks) {
                    displayTasks.push("");
                  }

                  return (
                    <td
                      key={d.key}
                      style={{
                        padding: "3.5mm",
                        width: "33.33%",
                        height: "70mm",
                        verticalAlign: "top",
                        border: `1.5px solid #475569`,
                        backgroundColor: "#ffffff",
                      }}
                    >
                      {/* ONLY the header of each day has the custom bg and text color */}
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "10.5pt",
                          color: customTextColor,
                          backgroundColor: customBgColor,
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact",
                          marginBottom: "3mm",
                          borderBottom: `2px solid ${customTextColor}`,
                          paddingBottom: "1.5mm",
                          paddingLeft: "2.5mm",
                          paddingTop: "1.5mm",
                          borderRadius: "4px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center"
                        }}
                      >
                        <span>{d.label}</span>
                      </div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "9pt", lineHeight: 1.55 }}>
                        {displayTasks.map((t, i) => (
                          <li
                            key={i}
                            style={{
                              marginBottom: "1.5mm",
                              display: "flex",
                              alignItems: "flex-start",
                              borderBottom: t ? "none" : "1px dashed #cbd5e1",
                              paddingBottom: t ? "0" : "1.5mm",
                              height: "5.5mm",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: "11px",
                                height: "11px",
                                border: `1.5px solid #475569`,
                                borderRadius: "2.5px",
                                marginRight: "6px",
                                marginTop: "2px",
                                flexShrink: 0,
                                backgroundColor: "#ffffff"
                              }}
                            />
                            <span style={{ color: t ? "#1a202c" : "transparent" }}>{t || "placeholder"}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8pt", color: "#475569", borderTop: `1.5px solid #cbd5e1`, paddingTop: "2.5mm" }}>
        <span>Cesar Home Plan</span>
        <div style={{ fontWeight: "600" }}>
          <span>Assinatura: ___________________________</span>
        </div>
      </div>
    </div>
  );
}
