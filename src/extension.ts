import * as vscode from "vscode";

import { AnthropicProvider } from "./providers/anthropic";
import { GroqProvider } from "./providers/groq";

const apiKeyAnthropic = "AnthropicCopilotBoostApiKey";
const apiKeyGroq = "GroqCopilotBoostApiKey";

export async function activate(context: vscode.ExtensionContext) {
  const AnthropicApiKey = await context.secrets.get(apiKeyAnthropic);
  const groqApiKey = await context.secrets.get(apiKeyGroq);

  // API Key
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.anthropic.setKey", () => setApiKey(context, apiKeyAnthropic))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.groq.setKey", () => setApiKey(context, apiKeyGroq))
  );

  // Create boostProvider with API Key
  const Anthropic = new AnthropicProvider(AnthropicApiKey);
  const groq = new GroqProvider(groqApiKey);

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
}
