import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { INITIAL_TASKS, USERS, DAYS, type DayKey, type UserName } from "@/lib/initial-tasks";

const userEnum = z.enum(USERS as unknown as [UserName, ...UserName[]]);
const dayEnum = z.enum(DAYS.map((d) => d.key) as [DayKey, ...DayKey[]]);

export default defineTool({
  name: "get_default_tasks",
  title: "Get default tasks",
  description:
    "Get the default household tasks for a given family member. Optionally filter by a specific day of the week. Returns the shipped defaults — not the user's edits, which live in the browser.",
  inputSchema: {
    user: userEnum.describe("The family member's name."),
    day: dayEnum.optional().describe("Optional day key (e.g. 'segunda'). Omit to get the full week."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ user, day }) => {
    const week = INITIAL_TASKS[user];
    const payload = day ? { user, day, tasks: week[day] } : { user, week };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});