import { describe, it, expect } from "vitest";
import { routineOccursOn, type Routine } from "./monthly";

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
