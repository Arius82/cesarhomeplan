import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DAYS, INITIAL_TASKS, USERS, type DayKey, type UserName, type WeekTasks, type UserTheme, THEMES, ICONS, DEFAULT_USER_SETTINGS } from "@/lib/initial-tasks";

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...makeInitialState(), ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

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

  const updateUser = (u: UserName, fn: (s: AppState[UserName]) => AppState[UserName]) =>
    setState((prev) => ({ ...prev, [u]: fn(prev[u]) }));

  const addTask = (day: DayKey, text: string) => {
    if (!text.trim()) return;
    updateUser(active, (s) => ({ ...s, tasks: { ...s.tasks, [day]: [...s.tasks[day], text.trim()] } }));
  };

  const removeTask = (day: DayKey, idx: number) => {
    updateUser(active, (s) => {
      const tasks = { ...s.tasks, [day]: s.tasks[day].filter((_, i) => i !== idx) };
      // Clean up checked keys when a task is removed. 
      // Since tasks are indexed by position, we need to rebuild checked state or clean up appropriately.
      // Rebuilding checked state to shift indices if necessary:
      const newChecked = {} as Record<string, boolean>;
      Object.entries(s.checked).forEach(([k, val]) => {
        const [dKey, iStr] = k.split("-");
        if (dKey === day) {
          const index = parseInt(iStr, 10);
          if (index < idx) {
            newChecked[k] = val;
          } else if (index > idx) {
            newChecked[`${dKey}-${index - 1}`] = val;
          }
        } else {
          newChecked[k] = val;
        }
      });
      return { ...s, tasks, checked: newChecked };
    });
  };

  const toggleCheck = (day: DayKey, idx: number) => {
    const key = `${day}-${idx}`;
    updateUser(active, (s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
  };

  const setWeek = (week: string) => updateUser(active, (s) => ({ ...s, week }));
  const setIcon = (icon: string) => updateUser(active, (s) => ({ ...s, icon }));
  const setCustomBgColor = (color: string) => updateUser(active, (s) => ({ ...s, customBgColor: color }));
  const setCustomTextColor = (color: string) => updateUser(active, (s) => ({ ...s, customTextColor: color }));

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
              onClick={handlePrintActive}
              style={{
                backgroundColor: user.customTextColor,
                color: "#ffffff"
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold transition-all shadow hover:opacity-90 cursor-pointer"
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
                style={{
                  borderBottomColor: isSelected ? uConfig.customTextColor : "transparent",
                  color: isSelected ? uConfig.customTextColor : undefined,
                }}
                className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? ""
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
          <div 
            style={{
              backgroundColor: `${user.customTextColor}08`,
              borderColor: `${user.customTextColor}20`,
              color: user.customTextColor
            }}
            className="mb-6 rounded-xl border p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-in fade-in duration-350"
          >
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
                  style={{ backgroundColor: user.customTextColor, color: "#ffffff" }}
                  className="px-4 py-1.5 text-xs font-bold rounded-md shadow-sm transition-all hover:opacity-90 cursor-pointer"
                >
                  Instalar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Customization Bar */}
        <div 
          style={{
            backgroundColor: user.customBgColor,
            borderColor: `${user.customTextColor}25`,
            color: user.customTextColor
          }}
          className="mb-6 rounded-xl border p-5 shadow-sm transition-all duration-300 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold">Semana:</label>
              <input
                value={user.week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="ex: 23/06 a 28/06"
                style={{ borderColor: `${user.customTextColor}30` }}
                className="rounded-md border bg-background px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-1"
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
                        ? "bg-background shadow border border-current scale-110"
                        : "hover:bg-background/40 border border-transparent"
                    }`}
                  >
                    {ic.char}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 border-t border-current/10 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cor de Fundo:</span>
              <input
                type="color"
                value={user.customBgColor}
                onChange={(e) => setCustomBgColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-current/25 bg-transparent p-0.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Cor do Texto/Dia:</span>
              <input
                type="color"
                value={user.customTextColor}
                onChange={(e) => setCustomTextColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-current/25 bg-transparent p-0.5"
              />
            </div>

            <div className="h-6 w-px bg-current/15 hidden md:block"></div>

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
                    onClick={() => {
                      updateUser(active, (s) => ({
                        ...s,
                        theme: themeKey,
                        customBgColor: DEFAULT_USER_SETTINGS[active].customBgColor,
                        customTextColor: DEFAULT_USER_SETTINGS[active].customTextColor
                      }));
                    }}
                    title={cfg.name}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all border border-current/15 hover:bg-background/40 cursor-pointer"
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

function DayCard({
  day,
  label,
  tasks,
  checked,
  onToggle,
  onAdd,
  onRemove,
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
  customBgColor: string;
  customTextColor: string;
}) {
  const [text, setText] = useState("");
  return (
    <div 
      style={{
        backgroundColor: customBgColor,
        borderColor: `${customTextColor}30`,
        color: customTextColor
      }}
      className="rounded-xl border p-5 shadow-sm transition-all duration-200"
    >
      <h3 
        style={{ borderColor: `${customTextColor}20` }}
        className="mb-4 border-b pb-2 text-sm font-bold tracking-wide flex items-center justify-between"
      >
        <span>{label}</span>
      </h3>
      <ul className="space-y-3 min-h-[140px]">
        {tasks.map((t, i) => {
          const key = `${day}-${i}`;
          const isChecked = !!checked[key];
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(day, i)}
                style={{ accentColor: customTextColor }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded cursor-pointer"
              />
              <span className={`flex-1 transition-all ${isChecked ? "opacity-40 line-through" : "font-medium"}`}>{t}</span>
              <button
                onClick={() => onRemove(day, i)}
                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded hover:bg-background/50 cursor-pointer"
                aria-label="Remover tarefa"
              >
                ✕
              </button>
            </li>
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
          style={{ borderColor: `${customTextColor}20` }}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 transition-all placeholder:text-muted-foreground/50"
        />
        <button
          type="submit"
          style={{
            backgroundColor: customTextColor,
            color: "#ffffff"
          }}
          className="rounded-md px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-all active:scale-95 hover:opacity-90 cursor-pointer"
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
      color: customTextColor,
      backgroundColor: "#ffffff",
      border: `2.5px solid ${customTextColor}`,
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
              <span style={{ fontSize: "18pt", fontWeight: "900", textTransform: "uppercase", tracking: "0.05em", color: customTextColor }}>
                {user}
              </span>
              <span style={{ fontSize: "8.5pt", color: "#666", fontWeight: "600" }}>
                Cronograma de Tarefas Semanais
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13pt", fontWeight: "800", color: customTextColor }}>
              Uma casa organizada é uma casa feliz 😊
            </div>
            <div style={{ fontSize: "10pt", color: "#333", marginTop: "4px", fontWeight: "600" }}>
              Semana: <span style={{ borderBottom: `1.5px solid ${customTextColor}`, paddingBottom: "1px", minWidth: "120px", display: "inline-block", textAlign: "center" }}>{week || "________________"}</span>
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
                        border: `1.5px solid ${customTextColor}`,
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "10.5pt",
                          color: customTextColor,
                          marginBottom: "3mm",
                          borderBottom: `2px solid ${customTextColor}`,
                          paddingBottom: "1.5mm",
                          backgroundColor: `${customTextColor}15`,
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
                              borderBottom: t ? "none" : "1px dashed #e2e8f0",
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
                                border: `1.5px solid ${customTextColor}`,
                                borderRadius: "2.5px",
                                marginRight: "6px",
                                marginTop: "2px",
                                shrink: 0,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8pt", color: "#4a5568", borderTop: `1.5px solid ${customTextColor}30`, paddingTop: "2.5mm" }}>
        <span>Gerado com ❤️ por Cesar Home Plan e Lovable</span>
        <div style={{ fontWeight: "600" }}>
          <span>Assinatura: ___________________________</span>
        </div>
      </div>
    </div>
  );
}
