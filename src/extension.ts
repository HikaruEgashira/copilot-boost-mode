import * as vscode from "vscode";

import { AnthropicProvider } from "./providers/anthropic";
import { GroqProvider } from "./providers/groq";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { OpenAIProvider } from "./providers/openai";

const apiKeyAnthropic = "AnthropicCopilotBoostApiKey";
const apiKeyGroq = "GroqCopilotBoostApiKey";
const apiKeyGemini = "GeminiCopilotBoostApiKey";
const apiKeyOpenRouter = "OpenRouterCopilotBoostApiKey";
const apiKeyOpenAI = "OpenAICopilotBoostApiKey";

export async function activate(context: vscode.ExtensionContext) {
  const AnthropicApiKey = await context.secrets.get(apiKeyAnthropic);
  const groqApiKey = await context.secrets.get(apiKeyGroq);
  const geminiApiKey = await context.secrets.get(apiKeyGemini);
  const openrouterApiKey = await context.secrets.get(apiKeyOpenRouter);
  const openaiApiKey = await context.secrets.get(apiKeyOpenAI);

  // API Key
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.anthropic.setKey", () => setApiKey(context, apiKeyAnthropic))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.groq.setKey", () => setApiKey(context, apiKeyGroq))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.gemini.setKey", () => setApiKey(context, apiKeyGemini))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.openrouter.setKey", () => setApiKey(context, apiKeyOpenRouter))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.openai.setKey", () => setApiKey(context, apiKeyOpenAI))
  );

  // Create boostProvider with API Key
  const Anthropic = new AnthropicProvider(AnthropicApiKey);
  const groq = new GroqProvider(groqApiKey);
  const gemini = new GeminiProvider(geminiApiKey);
  const openrouter = new OpenRouterProvider(openrouterApiKey);
  const openai = new OpenAIProvider(openaiApiKey);

  // Register the providers
  const AnthropicDisposable = vscode.lm.registerChatModelProvider(
    "anthropic",
    Anthropic,
    {
      "vendor": "boost",
      "name": "Anthropic",
      "family": "boost",
      "version": "1.0.0",
      "maxInputTokens": 200000,
      "maxOutputTokens": 8192,
      isDefault: true,
      isUserSelectable: true,
      capabilities: {
        agentMode: true,
        toolCalling: true,
        vision: true
      }
    }
  )
  context.subscriptions.push(AnthropicDisposable)

  const groqDisposable = vscode.lm.registerChatModelProvider(
    "groq",
    groq,
    {
      "vendor": "boost",
      "name": "Groq",
      "family": "boost",
      "version": "1.0.0",
      "maxInputTokens": 200000,
      "maxOutputTokens": 8192,
      isDefault: true,
      isUserSelectable: true,
      capabilities: {
        agentMode: true,
        toolCalling: true,
        vision: true
      }
    }
  )
  context.subscriptions.push(groqDisposable)

  const geminiDisposable = vscode.lm.registerChatModelProvider(
    "gemini",
    gemini,
    {
      "vendor": "boost",
      "name": "Gemini",
      "family": "boost",
      "version": "1.0.0",
      "maxInputTokens": 200000,
      "maxOutputTokens": 8192,
      isDefault: true,
      isUserSelectable: true,
      capabilities: {
        agentMode: true,
        toolCalling: true,
        vision: true
      }
    }
  )
  context.subscriptions.push(geminiDisposable)

  const openrouterDisposable = vscode.lm.registerChatModelProvider(
    "openrouter",
    openrouter,
    {
      vendor: "boost",
      name: "OpenRouter",
      family: "boost",
      version: "1.0.0",
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      isDefault: true,
      isUserSelectable: true,
      capabilities: {
        agentMode: true,
        toolCalling: true,
        vision: true
      }
    }
  );
  context.subscriptions.push(openrouterDisposable);

  const openaiDisposable = vscode.lm.registerChatModelProvider(
    "openai",
    openai,
    {
      vendor: "boost",
      name: "OpenAI",
      family: "boost",
      version: "1.0.0",
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      isDefault: true,
      isUserSelectable: true,
      capabilities: {
        agentMode: true,
        toolCalling: true,
        vision: true
      }
    }
  );
  context.subscriptions.push(openaiDisposable);
}

async function setApiKey(context: vscode.ExtensionContext, key: string) {
  const value = await vscode.window.showInputBox({
    prompt: "Enter your API Key",
  });

  if (value) {
    context.secrets.store(key, value);
    return value;
  }

  return await context.secrets.get(key);
}

export function deactivate(context: vscode.ExtensionContext) {
  context.secrets.delete(apiKeyAnthropic);
  context.secrets.delete(apiKeyGroq);
  context.secrets.delete(apiKeyGemini);
  context.secrets.delete(apiKeyOpenAI);
}
