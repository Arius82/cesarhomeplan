import { describe, it, expect } from "vitest";
import { routineOccursOn, routineEditPatch, type Routine } from "./monthly";

const base: Routine = { id: "1", user_name: "Miguel", title: "x", day_of_month: null, specific_date: null, completed: [], updated_at: "" };

describe("rotinas mensais", () => {
  it("dia fixo repete todo mês", () => {
    const r = { ...base, day_of_month: 10 };
    expect(routineOccursOn(r, new Date(2026, 10, 10))).toBe(true);
    expect(routineOccursOn(r, new Date(2026, 11, 10))).toBe(true);
    expect(routineOccursOn(r, new Date(2026, 11, 11))).toBe(false);
  });
  it("dia 31 cai no último dia em meses curtos", () => {
    const r = { ...base, day_of_month: 31 };
    expect(routineOccursOn(r, new Date(2026, 10, 30))).toBe(true);
  });
  it("data pontual só ocorre naquela data", () => {
    const r = { ...base, specific_date: "2026-11-25" };
    expect(routineOccursOn(r, new Date(2026, 10, 25))).toBe(true);
    expect(routineOccursOn(r, new Date(2026, 11, 25))).toBe(false);
  });
});

import { monthlyForWeek as mfw } from "./monthly";
describe("monthlyForWeek", () => {
  const mk = (o: Partial<import("./monthly").Routine>) => ({ id: "x", user_name: "Miguel", title: "t", day_of_month: null, specific_date: null, completed: [], updated_at: "", ...o });
  it("places a day-of-month routine on its weekday column of the current week", () => {
    // Wed 18 Nov 2026 -> week Mon 16 .. Sun 22
    const cols = mfw([mk({ day_of_month: 19 })], "Miguel", new Date(2026, 10, 18));
    expect(cols[3]?.length).toBe(1); // Thursday
    expect(cols.flat().length).toBe(1);
  });
  it("puts Sunday routines on Saturday and ignores other users", () => {
    const cols = mfw([mk({ day_of_month: 22 }), mk({ day_of_month: 17, user_name: "Davi" })], "Miguel", new Date(2026, 10, 18));
    expect(cols[5]?.[0]?.isSunday).toBe(true);
    expect(cols.flat().length).toBe(1);
  });
});

describe("editing a monthly routine from either view", () => {
  it("changes the original recurring title/day for every month without clearing completion", () => {
    const routine = { ...base, day_of_month: 24, completed: ["2026-11-24"] };
    const patch = routineEditPatch("Limpar filtro", "monthly", 31, "2026-11-24");
    expect(patch).toEqual({ title: "Limpar filtro", day_of_month: 31, specific_date: null });
    const edited = { ...routine, ...patch };
    expect(edited.completed).toEqual(["2026-11-24"]);
    expect(routineOccursOn(edited, new Date(2026, 10, 30))).toBe(true);
    expect(routineOccursOn(edited, new Date(2026, 11, 31))).toBe(true);
    expect(routineOccursOn(edited, new Date(2026, 10, 24))).toBe(false);
  });
  it("moves a one-time routine to the selected date without making it recur", () => {
    const patch = routineEditPatch("Trocar filtro", "once", 24, "2026-11-25");
    expect(patch).toEqual({ title: "Trocar filtro", day_of_month: null, specific_date: "2026-11-25" });
    const edited = { ...base, ...patch };
    expect(routineOccursOn(edited, new Date(2026, 10, 25))).toBe(true);
    expect(routineOccursOn(edited, new Date(2026, 11, 25))).toBe(false);
  });
  it("rejects invalid monthly days and invalid dates", () => {
    expect(routineEditPatch("Filtro", "monthly", 32, "2026-11-24")).toBeNull();
    expect(routineEditPatch("Filtro", "once", 24, "2026-02-30")).toBeNull();
  });
});
