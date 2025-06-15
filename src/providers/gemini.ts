import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";
import { convertChatToCoreMessage, createGeminiToolName, logToolConfiguration, processTools } from "./util";

export class GeminiProvider implements vscode.LanguageModelChatProvider {
  apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  private showApiKeyError(message: string): Error {
    vscode.window.showErrorMessage(message, "Set API Key").then((selection) => {
      if (selection === "Set API Key") {
        vscode.commands.executeCommand("copilot-boost-mode.gemini.setKey").then(() => {
          vscode.window
            .showInformationMessage(
              "API Key set successfully. Please restart the window to apply the changes.",
              "Reload Window"
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
    token: vscode.CancellationToken
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ): Promise<any> {
    if (!this.apiKey) {
      const setKeyMessage = "No API key set. Please set your API key in the settings.";
      throw this.showApiKeyError(setKeyMessage);
    }

    const config = vscode.workspace.getConfiguration("copilot-boost-mode.gemini");
    const modelName = config.get<string>("modelName") || "gemini-2.5-pro-exp-03-25";

    // Create an abort controller and listen for cancellation requests
    const abortController = new AbortController();
    token.onCancellationRequested(() => abortController.abort());

    // Process tools with Gemini-specific name sanitization
    const { tools, hasTools } = processTools(options, "Gemini", createGeminiToolName);

    // Determine the tool choice based on the tool mode
    let toolChoice: "auto" | "required" | undefined = undefined;
    if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
      toolChoice = "required";
    } else if (options.toolMode === vscode.LanguageModelChatToolMode.Auto) {
      toolChoice = "auto";
    }

    const boostMessages = messages.map(convertChatToCoreMessage);

    const gemini = createGoogleGenerativeAI({
      apiKey: this.apiKey,
    });

    // Log configuration for debugging
    logToolConfiguration("Gemini", hasTools, tools, modelName, toolChoice, {
      toolCallStreaming: true,
    });

    const streamConfig = {
      model: gemini(modelName),
      messages: boostMessages,
      toolChoice: hasTools ? toolChoice : undefined,
      tools: hasTools ? tools : undefined,
      abortSignal: abortController.signal,
      toolCallStreaming: true,
    };

    logger.log(`[Gemini] Stream config: ${JSON.stringify({ ...streamConfig, messages: "omitted", model: "omitted" })}`);

    const { fullStream } = streamText(streamConfig);

    // Listen for response parts and update the progress
    try {
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
    } catch (streamError) {
      logger.error("[Gemini] streaming error:", streamError);
      if (streamError instanceof Error && streamError.cause) {
        logger.error("[Gemini] Streaming error cause:", JSON.stringify(streamError.cause, null, 2));
      }
      throw streamError;
    }
  }

  provideTokenCount(
    _text: string | vscode.LanguageModelChatMessage,
    _token: vscode.CancellationToken
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
