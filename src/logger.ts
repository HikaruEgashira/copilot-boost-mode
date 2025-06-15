import * as vscode from "vscode";

export const channel = vscode.window.createOutputChannel("copilot-boost-mode");
const formatArg = (arg: unknown): string => {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
  }
  if (typeof arg === "object" && arg !== null) {
    return JSON.stringify(arg, null, 2);
  }
  return String(arg);
};

export const logger = {
  log: (...args: unknown[]) => {
    channel.appendLine(`[LOG] ${args.map(formatArg).join(" ")}`);
  },
  info: (...args: unknown[]) => {
    channel.appendLine(`[INFO] ${args.map(formatArg).join(" ")}`);
  },
  error: (...args: unknown[]) => {
    channel.appendLine(`[ERROR] ${args.map(formatArg).join(" ")}`);
  },
  warn: (...args: unknown[]) => {
    channel.appendLine(`[WARN] ${args.map(formatArg).join(" ")}`);
  },
};
