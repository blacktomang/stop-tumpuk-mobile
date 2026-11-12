import type { MaterialStatus } from "../../types";
import type { MaterialListFilter } from "../../application/material-management-service";

export const materialFilters: readonly {
  key: MaterialListFilter;
  label: string;
}[] = [
  { key: "inbox", label: "Inbox" },
  { key: "reading-plan", label: "Reading plan" },
  { key: "in-progress", label: "In Progress" },
  { key: "finished", label: "Finished" },
  { key: "archived", label: "Archived" },
];

export type MaterialAction =
  | "commit"
  | "open"
  | "start"
  | "finish"
  | "reopen"
  | "return-to-inbox"
  | "archive"
  | "edit"
  | "delete";

export interface MaterialActionGroup {
  primary: MaterialAction;
  advanced: readonly MaterialAction[];
}

export function actionGroupForStatus(
  status: MaterialStatus,
): MaterialActionGroup {
  switch (status) {
    case "inbox":
      return {
        primary: "commit",
        advanced: ["edit", "archive", "delete"],
      };
    case "queued":
      return {
        primary: "open",
        advanced: ["start", "edit", "return-to-inbox", "archive", "delete"],
      };
    case "in-progress":
      return {
        primary: "finish",
        advanced: ["open", "edit", "return-to-inbox", "archive", "delete"],
      };
    case "completed":
      return {
        primary: "open",
        advanced: ["reopen", "edit", "return-to-inbox", "archive", "delete"],
      };
    case "archived":
      return {
        primary: "reopen",
        advanced: ["open", "edit", "delete"],
      };
  }
}

export function actionLabel(action: MaterialAction): string {
  switch (action) {
    case "commit":
      return "Commit";
    case "open":
      return "Open source";
    case "start":
      return "Mark In Progress";
    case "finish":
      return "Finish";
    case "reopen":
      return "Reopen";
    case "return-to-inbox":
      return "Return to Inbox";
    case "archive":
      return "Archive";
    case "edit":
      return "Edit material";
    case "delete":
      return "Delete";
  }
}
