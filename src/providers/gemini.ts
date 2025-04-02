// filepath: /Users/hikae/ghq/github.com/HikaruEgashira/copilot-boost-mode/src/providers/gemini.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AssistantContent, CoreMessage, jsonSchema, streamText, TextPart, Tool, ToolResultPart } from "ai";
import * as vscode from "vscode";
import { logger } from "../logger";

const convertChatToCoreMessage = (message: vscode.LanguageModelChatMessage): CoreMessage => {
    // Convert a `vscode.LanguageModelChatMessage` to a `UserMessage` or `ToolMessage`
    if (message.role === vscode.LanguageModelChatMessageRole.User) {
        const toolResultParts: ToolResultPart[] = [];
        const textParts: TextPart[] = [];

        for (const item of message.content) {
            // If the message is a tool result part, add it to the `toolResultParts` array.
            if (item instanceof vscode.LanguageModelToolResultPart) {
                toolResultParts.push({
                    type: 'tool-result',
                    toolCallId: item.callId,
                    result: item.content.map((item) => {
                        if (item instanceof vscode.LanguageModelTextPart) {
                            return item.value;
                        } else {
                            return JSON.stringify(item);
                        }
                    }).join(' ,'),
                    toolName: 'test'
                });
            }
            // If the message is a text part, add it to the `textParts` array.
            else if (item instanceof vscode.LanguageModelTextPart && item.value) {
                textParts.push({ type: 'text', text: item.value });
            }
        }
        // Return the `UserMessage` or `ToolMessage` based on the content.
        if (toolResultParts.length) {
            return { role: 'tool', content: toolResultParts };
        } else if (textParts.length) {
            return { role: 'user', content: textParts };
        } else {
            return { role: 'user', content: JSON.stringify(message.content) };
        }
    }
    // Convert a `vscode.LanguageModelChatMessage` to an `AssistantMessage`.
    else if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
        const content: AssistantContent = message.content.map((item) => {
            if (item instanceof vscode.LanguageModelTextPart) {
                return { type: 'text', text: item.value };
            } else if (item instanceof vscode.LanguageModelToolCallPart) {
                let toolArgs: any = item.input;
                try {
                    toolArgs = JSON.parse(toolArgs);
                } catch (error) {
                    logger.error('Skipping tool call argument parsing');
                }
                return {
                    type: 'tool-call',
                    args: toolArgs,
                    toolName: item.name,
                    toolCallId: item.callId
                };
            } else {
                return { type: 'text', text: '' };
            }
        });
        return { role: 'assistant', content: content };
    } else {
        // Convert a `vscode.LanguageModelChatMessage` to a `SystemMessage`.
        const content = message.content
            .map((item) => {
                return item instanceof vscode.LanguageModelTextPart ? item.value.trim() : '';
            })
            .filter((item) => item.length).join(' ,');
        return { role: 'system', content: content };
    }
};


export class GeminiProvider implements vscode.LanguageModelChatProvider {
    apiKey: string | undefined

    constructor(apiKey: string | undefined) {
        this.apiKey = apiKey;
    }

    private showApiKeyError(message: string): Error {
        vscode.window.showErrorMessage(message, "Set API Key").then(selection => {
            if (selection === "Set API Key") {
                vscode.commands.executeCommand("copilot-boost-mode.gemini.setKey").then(() => {
                    vscode.window.showInformationMessage(
                        "API Key set successfully. Please restart the window to apply the changes.",
                        "Reload Window"
                    ).then(selection => {
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
    ): Promise<any> {
        if (!this.apiKey) {
            const setKeyMessage = "No API key set. Please set your API key in the settings.";
            throw this.showApiKeyError(setKeyMessage);
        }

        const config = vscode.workspace.getConfiguration('copilot-boost-mode.gemini');
        const modelName = config.get<string>('modelName') || 'gemini-2.5-pro-exp-03-25';

        // Create an abort controller and listen for cancellation requests
        const abortController = new AbortController();
        token.onCancellationRequested(() => abortController.abort());

        // Convert the tool configuration to a dictionary of tools
        const tools: Record<string, Tool> = {};
        for (const tool of (options.tools || [])) {
            // Gemini APIの関数名制約に対応するための変換
            // 文字またはアンダースコアで始まり、英数字、アンダースコア、ドット、ダッシュのみを含む必要がある
            const sanitizedName = tool.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
            const validToolName = /^[a-zA-Z_]/.test(sanitizedName) 
                ? sanitizedName 
                : `_${sanitizedName}`;
            
            // 最大長は64文字
            const truncatedName = validToolName.substring(0, 64);
            
            tools[truncatedName] = {
                parameters: jsonSchema(tool.inputSchema as any),
                description: tool.description,
            };
            
            // 元の名前と変換後の名前のマッピングをログに記録（デバッグ用）
            if (truncatedName !== tool.name) {
                logger.info(`Tool name converted: "${tool.name}" -> "${truncatedName}"`);
            }
        }

        // Determine the tool choice based on the tool mode
        let toolChoice: 'auto' | 'required' | undefined = undefined;
        if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
            toolChoice = 'required';
        } else if (options.toolMode === vscode.LanguageModelChatToolMode.Auto) {
            toolChoice = 'auto';
        }

        const boostMessages = messages.map(convertChatToCoreMessage);

        const gemini = createGoogleGenerativeAI({
            apiKey: this.apiKey,
        });

        const { fullStream, usage } = streamText({
            model: gemini(modelName),
            messages: boostMessages,
            toolChoice: toolChoice,
            tools: tools,
            abortSignal: abortController.signal,
            toolCallStreaming: true
        });

        // Listen for response parts and update the progress
        for await (const part of fullStream) {
            if (part.type === 'text-delta') {
                progress.report({
                    index: 0, part:
                        new vscode.LanguageModelTextPart(part.textDelta)
                });
                logger.info(`boostProvider: ${part.textDelta}`);
            } else if (part.type === 'tool-call') {
                progress.report({
                    index: 0,
                    part: new vscode.LanguageModelToolCallPart(
                        part.toolCallId, part.toolName, part.args
                    )
                });
            } else if (part.type === 'step-finish') {
            } else if (part.type === 'finish') {
            } else if (part.type === 'error') {
                throw part.error;
            }
        }
    }

    provideTokenCount(text: string | vscode.LanguageModelChatMessage, token: vscode.CancellationToken): Thenable<number> {
        try {
            // TODO
            return Promise.resolve(1);
        } catch (error) {
            logger.error(`Failed to count tokens: ${error}`);
            return Promise.reject(error);
        }
    }
}