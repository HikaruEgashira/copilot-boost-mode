import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";
import { convertChatToCoreMessage, logToolConfiguration, processTools } from "./util";

export class OpenAIProvider implements vscode.LanguageModelChatProvider {
  apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  private showApiKeyError(message: string): Error {
    vscode.window.showErrorMessage(message, "Set API Key").then((selection) => {
      if (selection === "Set API Key") {
        vscode.commands.executeCommand("copilot-boost-mode.openai.setKey").then(() => {
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

    const config = vscode.workspace.getConfiguration("copilot-boost-mode.openai");
    const modelName = config.get<string>("modelName") || "gpt-4.1-2025-04-14";
    const baseURL = config.get<string>("baseURL");

    // Create an abort controller and listen for cancellation requests
    const abortController = new AbortController();
    token.onCancellationRequested(() => abortController.abort());

    // Process tools with consistent validation and error handling
    const { tools, hasTools } = processTools(options, "OpenAI");

    // Determine the tool choice based on the tool mode
    let toolChoice: "auto" | "required" | undefined = undefined;
    if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
      toolChoice = "required";
    } else if (options.toolMode === vscode.LanguageModelChatToolMode.Auto) {
      toolChoice = "auto";
    }

    const boostMessages = messages.map(convertChatToCoreMessage);

    const openai = createOpenAI({
      apiKey: this.apiKey,
      baseURL: baseURL || undefined,
    });

    // Log configuration for debugging
    logToolConfiguration("OpenAI", hasTools, tools, modelName, toolChoice, {
      toolCallStreaming: false,
      baseURL: baseURL || "default",
    });

    const streamConfig = {
      model: openai(modelName),
      messages: boostMessages,
      toolChoice: hasTools ? toolChoice : undefined,
      tools: hasTools ? tools : undefined,
      abortSignal: abortController.signal,
      experimental_toolCallStreaming: false, // Use experimental flag
    };

    logger.log(`Stream config: ${JSON.stringify({ ...streamConfig, messages: "omitted", model: "omitted" })}`);

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
          // Skip incomplete tool calls that might come through despite toolCallStreaming: false
          if (part.toolCallId && part.toolName) {
            progress.report({
              index: 0,
              part: new vscode.LanguageModelToolCallPart(part.toolCallId, part.toolName, part.args),
            });
          } else {
            logger.log(`Skipping incomplete tool call: ${JSON.stringify(part)}`);
          }
        } else if (part.type === "tool-call-streaming-start") {
          // Ignore streaming tool call events when toolCallStreaming is false
          logger.log(`Ignoring tool-call-streaming-start: ${JSON.stringify(part)}`);
        } else if (part.type === "tool-call-delta") {
          // Ignore streaming tool call deltas when toolCallStreaming is false
          logger.log("Ignoring tool-call-delta");
        } else if (part.type === "step-finish") {
        } else if (part.type === "finish") {
        } else if (part.type === "error") {
          throw part.error;
        }
      }
    } catch (streamError) {
      logger.error("[OpenAI] streaming error:", streamError);
      if (streamError instanceof Error && streamError.cause) {
        logger.error("[OpenAI] Streaming error cause:", JSON.stringify(streamError.cause, null, 2));
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
