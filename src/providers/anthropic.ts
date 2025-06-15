import { createAnthropic } from "@ai-sdk/anthropic";
import { type Tool, jsonSchema, streamText } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";
import { convertChatToCoreMessage } from "./util";

export class AnthropicProvider implements vscode.LanguageModelChatProvider {
  apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  private showApiKeyError(message: string): Error {
    vscode.window.showErrorMessage(message, "Set API Key").then((selection) => {
      if (selection === "Set API Key") {
        vscode.commands.executeCommand("copilot-boost-mode.anthropic.setKey").then(() => {
          vscode.window
            .showInformationMessage(
              "API Key set successfully. Please restart the window to apply the changes.",
              "Reload Window",
            )
            .then((selection) => {
              if (selection === "Reload Window") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              }
            });
        });
      }
    });
    return new Error(message);
  }

  async provideLanguageModelResponse(
    messages: vscode.LanguageModelChatMessage[],
    options: vscode.LanguageModelChatRequestOptions,
    _extensionId: string,
    progress: vscode.Progress<vscode.ChatResponseFragment2>,
    token: vscode.CancellationToken,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ): Promise<any> {
    if (!this.apiKey) {
      const setKeyMessage = "No API key set. Please set your API key in the settings.";
      throw this.showApiKeyError(setKeyMessage);
    }

    const config = vscode.workspace.getConfiguration("copilot-boost-mode.anthropic");
    const modelName = config.get<string>("modelName") || "claude-3-7-sonnet-latest";

    // Create an abort controller and listen for cancellation requests
    const abortController = new AbortController();
    token.onCancellationRequested(() => abortController.abort());

    // Convert the tool configuration to a dictionary of tools
    const tools: Record<string, Tool> = {};
    for (const tool of options.tools || []) {
      tools[tool.name] = {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        parameters: jsonSchema(tool.inputSchema as any),
        description: tool.description,
      };
    }

    // Determine the tool choice based on the tool mode
    let toolChoice: "auto" | "required" | undefined = undefined;
    if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
      toolChoice = "required";
    } else if (options.toolMode === vscode.LanguageModelChatToolMode.Auto) {
      toolChoice = "auto";
    }

    const boostMessages = messages.map(convertChatToCoreMessage);

    const anthropic = createAnthropic({
      apiKey: this.apiKey,
    });

    const { fullStream } = streamText({
      model: anthropic(modelName),
      messages: boostMessages,
      toolChoice: toolChoice,
      tools: tools,
      abortSignal: abortController.signal,
      toolCallStreaming: true,
    });

    // Listen for response parts and update the progress
    for await (const part of fullStream) {
      if (part.type === "text-delta") {
        progress.report({
          index: 0,
          part: new vscode.LanguageModelTextPart(part.textDelta),
        });
        logger.info(`boostProvider: ${part.textDelta}`);
      } else if (part.type === "tool-call") {
        progress.report({
          index: 0,
          part: new vscode.LanguageModelToolCallPart(part.toolCallId, part.toolName, part.args),
        });
      } else if (part.type === "step-finish") {
      } else if (part.type === "finish") {
      } else if (part.type === "error") {
        throw part.error;
      }
    }
  }

  provideTokenCount(
    _text: string | vscode.LanguageModelChatMessage,
    _token: vscode.CancellationToken,
  ): Thenable<number> {
    try {
      // TODO
      return Promise.resolve(1);
    } catch (error) {
      logger.error(`Failed to count tokens: ${error}`);
      return Promise.reject(error);
    }
  }
}
