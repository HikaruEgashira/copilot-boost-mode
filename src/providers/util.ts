import type { AssistantContent, CoreMessage, TextPart, ToolResultPart } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";

function isLanguageModelToolResultPart(
  part: vscode.LanguageModelTextPart | vscode.LanguageModelToolResultPart | vscode.LanguageModelToolCallPart,
): part is vscode.LanguageModelToolResultPart {
  let _toolResultPart: vscode.LanguageModelToolResultPart
  if ("callId" in part && "content" in part) {
    _toolResultPart = part as vscode.LanguageModelToolResultPart;
    return true;
  }
  return false;
}

export const convertChatToCoreMessage = (message: vscode.LanguageModelChatMessage): CoreMessage => {
  // Convert a `vscode.LanguageModelChatMessage` to a `UserMessage` or `ToolMessage`
  if (message.role === vscode.LanguageModelChatMessageRole.User) {
    const toolResultParts: ToolResultPart[] = [];
    const textParts: TextPart[] = [];

    for (const item of message.content) {
      // If the message is a tool result part, add it to the `toolResultParts` array.
      if (isLanguageModelToolResultPart(item)) {
        toolResultParts.push({
          type: "tool-result",
          toolCallId: item.callId,
          result: item.content
            .map((item) => {
              if (item instanceof vscode.LanguageModelTextPart) {
                return item.value;
              }
              return JSON.stringify(item);
            })
            .join(" ,"),
          toolName: "test",
        });
      }
      // If the message is a text part, add it to the `textParts` array.
      else if (item instanceof vscode.LanguageModelTextPart && item.value) {
        textParts.push({ type: "text", text: item.value });
      }
    }
    // Return the `UserMessage` or `ToolMessage` based on the content.
    if (toolResultParts.length) {
      return { role: "tool", content: toolResultParts };
    }
    if (textParts.length) {
      return { role: "user", content: textParts };
    }
    return { role: "user", content: JSON.stringify(message.content) };
  }
  // Convert a `vscode.LanguageModelChatMessage` to an `AssistantMessage`.
  if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
    const content: AssistantContent = message.content.map((item) => {
      if (item instanceof vscode.LanguageModelTextPart) {
        return { type: "text", text: item.value };
      }
      if (item instanceof vscode.LanguageModelToolCallPart) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        let toolArgs: any = item.input;
        try {
          toolArgs = JSON.parse(toolArgs);
        } catch {
          logger.error("Skipping tool call argument parsing");
        }
        return {
          type: "tool-call",
          args: toolArgs,
          toolName: item.name,
          toolCallId: item.callId,
        };
      }
      return { type: "text", text: "" };
    });
    return { role: "assistant", content: content };
  }
  // Convert a `vscode.LanguageModelChatMessage` to a `SystemMessage`.
  const content = message.content
    .map((item) => {
      return item instanceof vscode.LanguageModelTextPart ? item.value.trim() : "";
    })
    .filter((item) => item.length)
    .join(" ,");
  return { role: "system", content: content };
};
