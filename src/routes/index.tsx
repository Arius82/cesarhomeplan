import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { DAYS, INITIAL_TASKS, USERS, type DayKey, type UserName, type WeekTasks, type UserTheme, THEMES, ICONS, DEFAULT_USER_SETTINGS, PRESET_COLORS } from "@/lib/initial-tasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Uma casa organizada é uma casa feliz" },
      { name: "description", content: "Organize as tarefas domésticas semanais de cada membro da família." },
    ],
  }),
  component: Index,
});

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

function Index() {
  const [state, setState] = useState<AppState>(makeInitialState);
  const [active, setActive] = useState<UserName>("Miguel");
  const [loaded, setLoaded] = useState(false);
  const [printMode, setPrintMode] = useState<"active" | "all">("active");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

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
    async (promise: Promise<any>, action: OfflineAction, successMessage?: string, options?: { silent?: boolean }) => {
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

  const logRpcError = (label: string) =>
    ({ error }: { error: any }) => {
      if (error) console.error(`RPC ${label} failed:`, error);
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
      supabase
        .from("user_planner")
        .upsert(userToRow(entry.user, entry.snapshot), { onConflict: "name" })
        .then(({ error }) => {
          if (error) console.error("undo upsert failed:", error);
        });
      // Switch to that user so the change is visible
      setActive(entry.user);
      return h.slice(0, -1);
    });
  };

  const addTask = (day: DayKey, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushHistory(active, `Adicionar tarefa em ${day}`);
    applyLocal(active, (s) => ({ ...s, tasks: { ...s.tasks, [day]: [...s.tasks[day], trimmed] } }));
    supabase.rpc("planner_add_task", { p_name: active, p_day: day, p_text: trimmed }).then(logRpcError("add_task"));
  };

  const removeTask = (day: DayKey, idx: number) => {
    pushHistory(active, `Remover tarefa de ${day}`);
    applyLocal(active, (s) => {
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
    supabase.rpc("planner_remove_task", { p_name: active, p_day: day, p_idx: idx }).then(logRpcError("remove_task"));
  };

  const toggleCheck = (day: DayKey, idx: number) => {
    const key = `${day}-${idx}`;
    pushHistory(active, `Marcar/desmarcar em ${day}`);
    applyLocal(active, (s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
    supabase.rpc("planner_toggle_check", { p_name: active, p_day: day, p_idx: idx }).then(logRpcError("toggle_check"));
  };

  const editTask = (day: DayKey, idx: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushHistory(active, `Editar tarefa em ${day}`);
    applyLocal(active, (s) => {
      const tasks = { ...s.tasks };
      tasks[day] = tasks[day].map((t, i) => (i === idx ? trimmed : t));
      return { ...s, tasks };
    });
    supabase.rpc("planner_edit_task", { p_name: active, p_day: day, p_idx: idx, p_text: trimmed }).then(logRpcError("edit_task"));
  };

  // Debounce week-text RPC to coalesce typing into one update
  const weekDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setWeek = (week: string) => {
    applyLocal(active, (s) => ({ ...s, week }));
    const u = active;
    if (weekDebounce.current[u]) clearTimeout(weekDebounce.current[u]);
    weekDebounce.current[u] = setTimeout(() => {
      supabase.rpc("planner_update_meta", { p_name: u, p_week: week }).then(logRpcError("update_meta(week)"));
    }, 400);
  };

  const setIcon = (icon: string) => {
    applyLocal(active, (s) => ({ ...s, icon }));
    supabase.rpc("planner_update_meta", { p_name: active, p_icon: icon }).then(logRpcError("update_meta(icon)"));
  };

  const setCustomBgColor = (color: string) => {
    applyLocal(active, (s) => ({ ...s, customBgColor: color }));
    supabase.rpc("planner_update_meta", { p_name: active, p_bg: color }).then(logRpcError("update_meta(bg)"));
  };

  const setCustomTextColor = (color: string) => {
    applyLocal(active, (s) => ({ ...s, customTextColor: color }));
    supabase.rpc("planner_update_meta", { p_name: active, p_text_color: color }).then(logRpcError("update_meta(text_color)"));
  };

  const applyThemePreset = (themeKey: UserTheme) => {
    const bg = PRESET_COLORS[themeKey].bg;
    const textColor = PRESET_COLORS[themeKey].text;
    applyLocal(active, (s) => ({ ...s, theme: themeKey, customBgColor: bg, customTextColor: textColor }));
    supabase
      .rpc("planner_update_meta", { p_name: active, p_theme: themeKey, p_bg: bg, p_text_color: textColor })
      .then(logRpcError("update_meta(theme)"));
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
            <span className="text-3xl">{user.icon}</span>
            <h1 className="text-2xl font-black tracking-tight">Uma casa organizada é uma casa feliz 😊</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              title={history.length > 0 ? `Desfazer: ${history[history.length - 1].label} (${history[history.length - 1].user})` : "Nada para desfazer"}
              className="rounded-md bg-secondary border border-border px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              ↶ Desfazer{history.length > 0 ? ` (${history.length})` : ""}
            </button>
            <button
              onClick={handlePrintActive}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold transition-all shadow hover:bg-primary/95 cursor-pointer"
            >
              Imprimir esta planilha (1 pág.)
            </button>
            <button
              onClick={handlePrintAll}
              className="rounded-md bg-secondary border border-border px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 shadow cursor-pointer"
            >
              Imprimir todas (4 págs.)
            </button>
          </div>
        </header>

        {/* User Navigation Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
          {USERS.map((u) => {
            const uConfig = state[u];
            const isSelected = active === u;
            return (
              <button
                key={u}
                onClick={() => setActive(u)}
                className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <span className="text-base">{uConfig.icon}</span>
                <span>{u}</span>
              </button>
            );
          })}
        </div>

        {/* PWA Installation Banner (no-print) */}
        {(showInstallBanner || showIOSNotification) && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-in fade-in duration-350 text-foreground">
            <div className="flex gap-3 items-center">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm font-bold">Instale o Cesar Home Plan no seu aparelho!</p>
                <p className="text-xs opacity-75 mt-0.5">
                  {showIOSNotification ? (
                    "Toque no botão de compartilhar ⎋ e depois selecione 'Adicionar à Tela de Início' ➕."
                  ) : (
                    "Tenha acesso super rápido na sua tela inicial, suporte offline e experiência completa de tela cheia."
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => {
                  setShowInstallBanner(false);
                }}
                className="px-3 py-1.5 text-xs font-bold opacity-70 hover:opacity-100 hover:bg-background/30 rounded-md transition-all cursor-pointer"
              >
                Agora não
              </button>
              {!showIOSNotification && (
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-1.5 text-xs font-bold rounded-md shadow-sm bg-primary text-primary-foreground transition-all hover:bg-primary/95 cursor-pointer"
                >
                  Instalar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Customization Bar */}
        <div className="mb-6 rounded-xl border border-border bg-muted/30 p-5 shadow-sm transition-all duration-300 flex flex-col gap-4 text-foreground">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold">Semana:</label>
              <input
                value={user.week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="ex: 23/06 a 28/06"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Figura:</span>
              <div className="flex flex-wrap gap-1">
                {ICONS.map((ic) => (
                  <button
                    key={ic.char}
                    onClick={() => setIcon(ic.char)}
                    title={ic.label}
                    className={`h-8 w-8 rounded text-lg flex items-center justify-center transition-all cursor-pointer ${
                      user.icon === ic.char
                        ? "bg-background shadow border border-border scale-110"
                        : "hover:bg-background/40 border border-transparent"
                    }`}
                  >
                    {ic.char}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cor de Fundo do Dia:</span>
              <input
                type="color"
                value={user.customBgColor}
                onChange={(e) => setCustomBgColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cor da Letra do Dia:</span>
              <input
                type="color"
                value={user.customTextColor}
                onChange={(e) => setCustomTextColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
            </div>

            <div className="h-6 w-px bg-border hidden md:block"></div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold opacity-75">Predefinições:</span>
              {Object.entries(THEMES).map(([key, cfg]) => {
                const themeKey = key as UserTheme;
                let dotColor = "bg-blue-500";
                if (themeKey === "emerald") dotColor = "bg-emerald-500";
                if (themeKey === "amber") dotColor = "bg-amber-500";
                if (themeKey === "pink") dotColor = "bg-pink-500";
                if (themeKey === "slate") dotColor = "bg-slate-500";

                return (
                  <button
                    key={themeKey}
                    onClick={() => applyThemePreset(themeKey)}
                    title={cfg.name}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all border border-border hover:bg-muted cursor-pointer"
                  >
                    <span className={`h-2 w-2 rounded-full ${dotColor}`}></span>
                    {cfg.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((d) => (
            <DayCard
              key={d.key}
              day={d.key}
              label={d.label}
              tasks={user.tasks[d.key]}
              checked={user.checked}
              onToggle={toggleCheck}
              onAdd={addTask}
              onRemove={removeTask}
              onEdit={editTask}
              customBgColor={user.customBgColor}
              customTextColor={user.customTextColor}
            />
          ))}
        </div>
      </div>

      {/* Printable Containers (Always rendered but toggle class hides/shows during printing) */}
      <div className="print-active-sheet">
        <PrintSheet
          user={active}
          week={user.week}
          tasks={user.tasks}
          customBgColor={user.customBgColor}
          customTextColor={user.customTextColor}
          icon={user.icon}
        />
      </div>

      <div className="print-all-sheets">
        {USERS.map((u) => {
          const uConfig = state[u];
          return (
            <div key={u} className="print-page-break">
              <PrintSheet
                user={u}
                week={uConfig.week}
                tasks={uConfig.tasks}
                customBgColor={uConfig.customBgColor}
                customTextColor={uConfig.customTextColor}
                icon={uConfig.icon}
              />
            </div>
          );
        })}
      </div>
    </div>
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
      <form onSubmit={handleSave} className="flex items-center gap-2 w-full py-0.5">
        <input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 text-foreground"
          autoFocus
        />
        <button
          type="submit"
          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
          title="Salvar"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => {
            setEditText(text);
            setIsEditing(false);
          }}
          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
          title="Cancelar"
        >
          ✕
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
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
          title="Editar tarefa"
          aria-label="Editar tarefa"
        >
          ✏️
        </button>
        <button
          onClick={() => onRemove(day, idx)}
          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
          title="Excluir tarefa"
          aria-label="Excluir tarefa"
        >
          🗑️
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
}: {
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
        {tasks.length === 0 && (
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
        className="mt-4 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground/50 text-foreground"
        />
        <button
          type="submit"
          className="rounded-md bg-primary text-primary-foreground px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-all active:scale-95 hover:bg-primary/90 cursor-pointer"
        >
          +
        </button>
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "26pt" }}>{icon}</span>
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
            <div style={{ fontSize: "13pt", fontWeight: "800", color: "#1e293b" }}>
              Uma casa organizada é uma casa feliz 😊
            </div>
            <div style={{ fontSize: "10pt", color: "#0f172a", marginTop: "4px", fontWeight: "600" }}>
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
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span>{d.label}</span>
                        <span style={{ fontSize: "10pt", opacity: 0.6 }}>{icon}</span>
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
        <span>Gerado com ❤️ por Cesar Home Plan e Lovable</span>
        <div style={{ fontWeight: "600" }}>
          <span>Assinatura: ___________________________</span>
        </div>
      </div>
    </div>
  );
}
