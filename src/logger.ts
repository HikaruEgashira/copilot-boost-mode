import * as vscode from "vscode";

export const channel = vscode.window.createOutputChannel("copilot-boost-mode");
export const logger = {
  log: (...args: unknown[]) => {
    channel.appendLine(
      `[LOG] ${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ")}`,
    );
  },
  info: (...args: unknown[]) => {
    channel.appendLine(
      `[INFO] ${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ")}`,
    );
  },
  error: (...args: unknown[]) => {
    channel.appendLine(
      `[ERROR] ${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ")}`,
    );
  },
  warn: (...args: unknown[]) => {
    channel.appendLine(
      `[WARN] ${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" ")}`,
    );
  },
};
