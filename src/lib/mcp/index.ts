import { defineMcp } from "@lovable.dev/mcp-js";
import listUsersTool from "./tools/list-users";
import listDaysTool from "./tools/list-days";
import getDefaultTasksTool from "./tools/get-default-tasks";

export default defineMcp({
  name: "cesar-home-planner-mcp",
  title: "César Home Planner MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the César Home Planner: list family members, list weekdays, and fetch the default household tasks per person and per day. Personal edits are stored in each browser and are not accessible here.",
  tools: [listUsersTool, listDaysTool, getDefaultTasksTool],
});