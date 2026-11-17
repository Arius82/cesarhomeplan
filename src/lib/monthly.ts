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
