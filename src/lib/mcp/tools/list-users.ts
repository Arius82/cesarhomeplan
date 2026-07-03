import { defineTool } from "@lovable.dev/mcp-js";
import { USERS } from "@/lib/initial-tasks";

export default defineTool({
  name: "list_users",
  title: "List family members",
  description: "List the family members (users) tracked in the César Home Planner.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(USERS) }],
    structuredContent: { users: [...USERS] },
  }),
});