import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RoutineActions } from "./RoutineActions";
import { type Routine, monthGrid, routineOccursOn, isDone, dateKey, MONTH_NAMES, WEEKDAY_SHORT } from "@/lib/monthly";

const db = supabase as any;

export function useMonthlyRoutines() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await db.from("monthly_routines").select("*").order("created_at");
      if (!cancelled && !error) setRoutines((data || []) as Routine[]);
    };
    void load();
    const channel = supabase
      .channel(`monthly_routines-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_routines" }, (p: any) => {
        setRoutines((prev) => {
          if (p.eventType === "DELETE") return prev.filter((r) => r.id !== p.old.id);
          const row = p.new as Routine;
          const exists = prev.some((r) => r.id === row.id);
          return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row];
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const report = (error: any, ok?: string) => {
    if (error) toast.error("Não foi possível salvar. Verifique a internet.");
    else if (ok) toast.success(ok);
  };

  const add = async (r: Omit<Routine, "id" | "completed" | "updated_at">) => {
    const { data, error } = await db.from("monthly_routines").insert(r).select().single();
    if (data) setRoutines((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
    report(error, "Rotina adicionada");
  };
  const update = async (id: string, patch: Partial<Routine>) => {
    const { data, error } = await db.from("monthly_routines").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (!error && data) setRoutines((prev) => prev.map((r) => (r.id === id ? data as Routine : r)));
    report(error);
    return !error && !!data;
  };
  const remove = async (id: string) => {
    const { data, error } = await db.from("monthly_routines").delete().eq("id", id).select("id").single();
    if (!error && data) setRoutines((prev) => prev.filter((r) => r.id !== id));
    report(error, "Rotina excluída");
    return !error && !!data;
  };
  const toggle = async (r: Routine, d: Date) => {
    const k = dateKey(d);
    const completed = r.completed.includes(k) ? r.completed.filter((x) => x !== k) : [...r.completed, k];
    await update(r.id, { completed });
  };
  return { routines, add, update, remove, toggle };
}

type Api = ReturnType<typeof useMonthlyRoutines>;

export function MonthlyView({ user, cursor, setCursor, api, customBgColor, customTextColor }: {
  user: string; cursor: Date; setCursor: (d: Date) => void; api: Api; customBgColor: string; customTextColor: string;
}) {
  const today = new Date();
  const [selected, setSelected] = useState<Date>(today);
  const [form, setForm] = useState<{ title: string; mode: "monthly" | "once" } | null>(null);
  const mine = api.routines.filter((r) => r.user_name === user);
  const cells = monthGrid(cursor);
  const dayRoutines = mine.filter((r) => routineOccursOn(r, selected));

  const shift = (n: number) => {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
    setCursor(d);
    setSelected(d);
  };

  const save = async () => {
    if (!form || !form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      day_of_month: form.mode === "monthly" ? selected.getDate() : null,
      specific_date: form.mode === "once" ? dateKey(selected) : null,
    };
    await api.add({ ...payload, user_name: user });
    setForm(null);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button onClick={() => shift(-1)} className="rounded-md border border-border px-3 py-1.5 text-sm font-bold cursor-pointer hover:bg-muted" aria-label="Mês anterior">‹</button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black">{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</h2>
            <button onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(t); }} className="rounded-md border border-border px-2 py-1 text-xs font-semibold cursor-pointer hover:bg-muted">Hoje</button>
          </div>
          <button onClick={() => shift(1)} className="rounded-md border border-border px-3 py-1.5 text-sm font-bold cursor-pointer hover:bg-muted" aria-label="Próximo mês">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
          {WEEKDAY_SHORT.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const list = mine.filter((r) => routineOccursOn(r, d));
            const isSel = dateKey(d) === dateKey(selected);
            const isToday = dateKey(d) === dateKey(today);
            const allDone = list.length > 0 && list.every((r) => isDone(r, d));
            return (
              <button key={i} onClick={() => setSelected(d)} aria-label={`Dia ${d.getDate()}`}
                className={`flex min-h-14 flex-col items-center rounded-md border p-1 text-sm cursor-pointer transition-all ${isSel ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted/40"} ${isToday ? "font-black" : ""}`}>
                <span>{d.getDate()}</span>
                {list.length > 0 && (
                  <span className="mt-1 rounded-full px-1.5 text-[10px] font-bold"
                    style={{ backgroundColor: customBgColor, color: customTextColor }}>
                    {allDone ? "✓" : list.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 font-bold flex items-center justify-between" style={{ backgroundColor: customBgColor, color: customTextColor }}>
          <span>{selected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
        </div>
        <div className="p-4 space-y-2">
          {dayRoutines.length === 0 && !form && <p className="text-sm text-muted-foreground">Nenhuma rotina neste dia.</p>}
          {dayRoutines.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <input type="checkbox" checked={isDone(r, selected)} onChange={() => api.toggle(r, selected)} className="h-4 w-4 cursor-pointer" aria-label={`Concluir ${r.title}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${isDone(r, selected) ? "line-through opacity-60" : ""}`}>{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{r.specific_date ? "Somente nesta data" : `Todo dia ${r.day_of_month}`}</p>
              </div>
              <RoutineActions routine={r} date={selected} onUpdate={api.update} onRemove={api.remove} />
            </div>
          ))}

          {form ? (
            <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-2 rounded-md border border-border p-3">
              <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Trocar roupa de cama" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" aria-label="Nome da rotina" />
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-2"><input type="radio" checked={form.mode === "monthly"} onChange={() => setForm({ ...form, mode: "monthly" })} /> Repetir todo dia {selected.getDate()}</label>
                <label className="flex items-center gap-2"><input type="radio" checked={form.mode === "once"} onChange={() => setForm({ ...form, mode: "once" })} /> Somente em {selected.toLocaleDateString("pt-BR")}</label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setForm(null)} className="px-3 py-1.5 text-xs rounded-md hover:bg-muted cursor-pointer">Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground cursor-pointer">Salvar</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setForm({ title: "", mode: "monthly" })} className="w-full rounded-md border border-dashed border-border py-2 text-sm font-semibold cursor-pointer hover:bg-muted/40">+ Nova rotina</button>
          )}
        </div>
      </div>

    </div>
  );
}

export function MonthlyPrintSheet({ user, icon, cursor, routines, customBgColor, customTextColor }: {
  user: string; icon: string; cursor: Date; routines: Routine[]; customBgColor: string; customTextColor: string;
}) {
  const mine = routines.filter((r) => r.user_name === user);
  const cells = monthGrid(cursor);
  const rows = cells.length / 7;
  const cellH = rows > 5 ? 24 : 29;
  return (
    <div className="print-sheet-content" style={{ padding: "5mm", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a", backgroundColor: "#ffffff", border: "2.5px solid #1e293b", borderRadius: "12px", height: "185mm", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box", pageBreakInside: "avoid" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3mm" }}>
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
              <span style={{ fontSize: "17pt", fontWeight: 900, textTransform: "uppercase", color: "#1e293b" }}>{user}</span>
              <span style={{ fontSize: "8.5pt", color: "#64748b", fontWeight: 600 }}>Rotinas Mensais</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12pt", fontWeight: 800, color: "#1e293b" }}>Uma casa organizada é uma casa feliz</div>
            <div style={{ fontSize: "11pt", fontWeight: 800, marginTop: "3px" }}>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</div>
          </div>
        </div>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <thead>
            <tr>{WEEKDAY_SHORT.map((w) => (
              <th key={w} style={{ fontSize: "9pt", padding: "1.2mm", backgroundColor: customBgColor, color: customTextColor, border: "1.5px solid #475569", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{w}</th>
            ))}</tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, ri) => (
              <tr key={ri}>
                {cells.slice(ri * 7, ri * 7 + 7).map((d, ci) => {
                  const list = d ? mine.filter((r) => routineOccursOn(r, d)) : [];
                  return (
                    <td key={ci} style={{ height: `${cellH}mm`, verticalAlign: "top", border: "1.5px solid #475569", padding: "1mm 1.5mm", backgroundColor: d ? "#ffffff" : "#f1f5f9", overflow: "hidden" }}>
                      {d && <div style={{ fontSize: "9pt", fontWeight: 800, color: "#1e293b" }}>{d.getDate()}</div>}
                      {list.slice(0, 3).map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: "3px", fontSize: "7pt", lineHeight: 1.25, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          <span style={{ display: "inline-block", width: "8px", height: "8px", border: "1.2px solid #475569", borderRadius: "2px", flexShrink: 0, marginTop: "1px" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                        </div>
                      ))}
                      {list.length > 3 && <div style={{ fontSize: "6.5pt", color: "#64748b" }}>+{list.length - 3} mais</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8pt", color: "#475569", borderTop: "1.5px solid #cbd5e1", paddingTop: "2mm" }}>
        <span>Cesar Home Plan</span>
        <span style={{ fontWeight: 600 }}>Assinatura: ___________________________</span>
      </div>
    </div>
  );
}
