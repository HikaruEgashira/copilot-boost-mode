import * as vscode from "vscode";

export const channel = vscode.window.createOutputChannel("copilot-boost-mode");
export const logger = {
  info: (message: string) => {
    channel.appendLine(`[INFO] ${message}`);
  },
  error: (message: string) => {
    channel.appendLine(`[ERROR] ${message}`);
  },
  warn: (message: string) => {
    channel.appendLine(`[WARN] ${message}`);
  },
};
