export type Routine = {
  id: string;
  user_name: string;
  title: string;
  day_of_month: number | null;
  specific_date: string | null;
  completed: string[];
  updated_at: string;
};

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function dateKey(d: Date) {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
}

export function routineEditPatch(title: string, mode: "monthly" | "once", day: number, date: string) {
  if (!title.trim()) return null;
  if (mode === "monthly" && (!Number.isInteger(day) || day < 1 || day > 31)) return null;
  if (mode === "once") {
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime()) || dateKey(parsed) !== date) return null;
  }
  return {
    title: title.trim(),
    day_of_month: mode === "monthly" ? day : null,
    specific_date: mode === "once" ? date : null,
  };
}

/** A routine fixed on day N repeats monthly; on short months, days beyond the last day fall on the last day. */
export function routineOccursOn(r: Routine, d: Date): boolean {
  if (r.specific_date) return r.specific_date === dateKey(d);
  if (r.day_of_month == null) return false;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.min(r.day_of_month, last) === d.getDate();
}

/** Completion is stored per occurrence: "YYYY-MM-DD". */
export function isDone(r: Routine, d: Date) {
  return r.completed.includes(dateKey(d));
}

export function monthGrid(cursor: Date): (Date | null)[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const lead = first.getDay(); // 0 = domingo
  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let i = 1; i <= days; i++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const WEEKDAY_SHORT = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];

export type WeekMonthlyItem = { routine: Routine; date: Date; isSunday: boolean };

/**
 * Monthly routines for the week (Mon–Sun) containing `today`, grouped into the
 * 6 planner columns (0 = Monday … 5 = Saturday). Sunday occurrences go to Saturday.
 */
export function monthlyForWeek(routines: Routine[], user: string, today: Date): WeekMonthlyItem[][] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (base.getDay() + 6) % 7; // days since Monday
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
  const cols: WeekMonthlyItem[][] = [[], [], [], [], [], []];
  const mine = routines.filter((r) => r.user_name === user);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    for (const r of mine) {
      if (routineOccursOn(r, d)) cols[Math.min(i, 5)].push({ routine: r, date: d, isSunday: i === 6 });
    }
  }
  return cols;
}
