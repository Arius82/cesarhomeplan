import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DAYS, INITIAL_TASKS, USERS, type DayKey, type UserName, type WeekTasks } from "@/lib/initial-tasks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Uma casa organizada é uma casa feliz" },
      { name: "description", content: "Organize as tarefas domésticas semanais de cada membro da família." },
    ],
  }),
  component: Index,
});

type AppState = Record<UserName, { week: string; tasks: WeekTasks; checked: Record<string, boolean> }>;

const STORAGE_KEY = "casa-organizada-v1";

function makeInitialState(): AppState {
  const state = {} as AppState;
  for (const u of USERS) {
    state[u] = { week: "", tasks: structuredClone(INITIAL_TASKS[u]), checked: {} };
  }
  return state;
}

function Index() {
  const [state, setState] = useState<AppState>(makeInitialState);
  const [active, setActive] = useState<UserName>("Miguel");
  const [loaded, setLoaded] = useState(false);

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
      const checked = { ...s.checked };
      delete checked[`${day}-${idx}`];
      return { ...s, tasks, checked };
    });
  };

  const toggleCheck = (day: DayKey, idx: number) => {
    const key = `${day}-${idx}`;
    updateUser(active, (s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
  };

  const setWeek = (week: string) => updateUser(active, (s) => ({ ...s, week }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Uma casa organizada é uma casa feliz 😊</h1>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Imprimir planilha (A4)
          </button>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
          {USERS.map((u) => (
            <button
              key={u}
              onClick={() => setActive(u)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active === u
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium">Semana:</label>
          <input
            value={user.week}
            onChange={(e) => setWeek(e.target.value)}
            placeholder="ex: 23/06 a 28/06"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            />
          ))}
        </div>
      </div>

      <PrintSheet user={active} week={user.week} tasks={user.tasks} />
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
}: {
  day: DayKey;
  label: string;
  tasks: string[];
  checked: Record<string, boolean>;
  onToggle: (d: DayKey, i: number) => void;
  onAdd: (d: DayKey, t: string) => void;
  onRemove: (d: DayKey, i: number) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="mb-3 border-b border-border pb-2 text-sm font-bold tracking-wide">{label}</h3>
      <ul className="space-y-2">
        {tasks.map((t, i) => {
          const key = `${day}-${i}`;
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!checked[key]}
                onChange={() => onToggle(day, i)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span className={`flex-1 ${checked[key] ? "text-muted-foreground line-through" : ""}`}>{t}</span>
              <button
                onClick={() => onRemove(day, i)}
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label="Remover tarefa"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(day, text);
          setText("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nova tarefa..."
          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          +
        </button>
      </form>
    </div>
  );
}

function PrintSheet({ user, week, tasks }: { user: UserName; week: string; tasks: WeekTasks }) {
  return (
    <div className="print-sheet hidden">
      <div style={{ padding: "4mm", fontFamily: "sans-serif", color: "#000" }}>
        <div style={{ textAlign: "center", fontSize: "14pt", fontWeight: "bold", marginBottom: "4mm" }}>
          Uma casa organizada é uma casa feliz 😊
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3mm" }}>
          <div style={{ fontSize: "12pt", fontWeight: "bold" }}>{user}</div>
          <div style={{ fontSize: "10pt" }}>
            Semana: {week || "________________"}
          </div>
        </div>
        <table className="print-table">
          <tbody>
            {[0, 3].map((rowStart) => (
              <tr key={rowStart} style={{ height: "50%" }}>
                {DAYS.slice(rowStart, rowStart + 3).map((d) => (
                  <td key={d.key} className="print-cell" style={{ padding: "2mm", width: "33.33%" }}>
                    <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "1.5mm", borderBottom: "1px solid #000", paddingBottom: "1mm" }}>
                      {d.label}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "9pt", lineHeight: 1.5 }}>
                      {(tasks[d.key].length ? tasks[d.key] : ["", "", "", ""]).map((t, i) => (
                        <li key={i} style={{ marginBottom: "0.5mm" }}>☐ {t}</li>
                      ))}
                      {Array.from({ length: Math.max(0, 7 - tasks[d.key].length) }).map((_, i) => (
                        <li key={`blank-${i}`} style={{ marginBottom: "0.5mm" }}>☐</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
