import { defineTool } from "@lovable.dev/mcp-js";
import { DAYS } from "@/lib/initial-tasks";

export default defineTool({
  name: "list_days",
  title: "List days of the week",
  description: "List the days of the week used by the planner (Monday through Saturday, in Portuguese).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(DAYS) }],
    structuredContent: { days: DAYS },
  }),
});