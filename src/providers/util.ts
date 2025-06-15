import type { AssistantContent, CoreMessage, TextPart, Tool, ToolResultPart } from "ai";
import { jsonSchema } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";

function isLanguageModelToolResultPart(
  part: vscode.LanguageModelTextPart | vscode.LanguageModelToolResultPart | vscode.LanguageModelToolCallPart,
): part is vscode.LanguageModelToolResultPart {
  let _toolResultPart: vscode.LanguageModelToolResultPart;
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

/**
 * Processes VSCode tools into AI SDK tools with consistent validation and error handling
 * @param options VSCode language model chat request options
 * @param providerName Name of the provider for logging purposes
 * @param toolNameTransform Optional function to transform tool names (e.g., for Gemini API constraints)
 * @returns Object with processed tools and hasTools flag
 */
export const processTools = (
  options: vscode.LanguageModelChatRequestOptions,
  providerName: string,
  toolNameTransform?: (name: string) => string,
): { tools: Record<string, Tool>; hasTools: boolean } => {
  const tools: Record<string, Tool> = {};

  for (const tool of options.tools || []) {
    // Apply tool name transformation if provided (e.g., for Gemini)
    const toolName = toolNameTransform ? toolNameTransform(tool.name) : tool.name;

    // Skip tools without a valid input schema
    if (!tool.inputSchema) {
      logger.warn(`[${providerName}] Tool '${tool.name}' has no input schema, providing default empty object schema`);
    }

    // Provide a default empty object schema if inputSchema is undefined or null
    const schema = tool.inputSchema || { type: "object", properties: {} };

    try {
      tools[toolName] = {
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK requires any type for flexibility
        parameters: jsonSchema(schema as any),
        description: tool.description,
      };

      // Log name transformation if applied
      if (toolNameTransform && toolName !== tool.name) {
        logger.info(`[${providerName}] Tool name converted: "${tool.name}" -> "${toolName}"`);
      }
    } catch (error) {
      logger.error(`[${providerName}] Failed to convert schema for tool '${tool.name}':`, error);
      logger.error(`[${providerName}] Tool inputSchema:`, tool.inputSchema);
      // Skip this tool if schema conversion fails
    }
  }

  const hasTools = Object.keys(tools).length > 0;
  return { tools, hasTools };
};

/**
 * Logs tool configuration details for debugging
 * @param providerName Name of the provider
 * @param hasTools Whether tools are available
 * @param tools The processed tools object
 * @param modelName The model name being used
 * @param toolChoice The tool choice setting
 * @param additionalConfig Any additional configuration to log
 */
export const logToolConfiguration = (
  providerName: string,
  hasTools: boolean,
  tools: Record<string, Tool>,
  modelName: string,
  toolChoice: "auto" | "required" | undefined,
  additionalConfig?: Record<string, unknown>,
): void => {
  logger.log(
    `[${providerName}] streamText config: modelName=${modelName}, toolChoice=${toolChoice}${
      additionalConfig
        ? `, ${Object.entries(additionalConfig)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}`
        : ""
    }`,
  );

  logger.log(`[${providerName}] Tools available: ${hasTools}, tool count: ${Object.keys(tools).length}`);
  if (hasTools) {
    logger.log(`[${providerName}] Tool names: ${Object.keys(tools).join(", ")}`);
  }
};

/**
 * Creates a Gemini-compatible tool name by sanitizing and truncating as needed
 * @param toolName Original tool name
 * @returns Sanitized tool name that meets Gemini API constraints
 */
export const createGeminiToolName = (toolName: string): string => {
  // Gemini API function name constraints:
  // - Must start with letter or underscore
  // - Can only contain alphanumeric characters, underscores, dots, and dashes
  // - Maximum length of 64 characters
  const sanitizedName = toolName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const validToolName = /^[a-zA-Z_]/.test(sanitizedName) ? sanitizedName : `_${sanitizedName}`;

  // Truncate to maximum length
  return validToolName.substring(0, 64);
};
