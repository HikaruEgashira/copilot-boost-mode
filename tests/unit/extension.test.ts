import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock all providers
mock.module("../../src/providers/anthropic", () => ({
  AnthropicProvider: mock(() => ({}))
}));

mock.module("../../src/providers/groq", () => ({
  GroqProvider: mock(() => ({}))
}));

mock.module("../../src/providers/gemini", () => ({
  GeminiProvider: mock(() => ({}))
}));

mock.module("../../src/providers/openai", () => ({
  OpenAIProvider: mock(() => ({}))
}));

mock.module("../../src/providers/openrouter", () => ({
  OpenRouterProvider: mock(() => ({}))
}));

mock.module("../../src/test-lm-api", () => ({
  registerTestCommands: mock(() => {})
}));

mock.module("../../src/test-runner", () => ({
  registerTestRunner: mock(() => {})
}));

// Mock child_process for macOS keychain test
mock.module("node:child_process", () => ({
  execSync: mock(() => '{"claudeAiOauth":{"accessToken":"test-token"}}')
}));

// Mock vscode
const mockExtensionContext = {
  secrets: {
    get: mock(() => Promise.resolve("test-api-key")),
    store: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve())
  },
  subscriptions: {
    push: mock(() => {})
  }
};

const mockCommands = {
  registerCommand: mock(() => ({ dispose: mock(() => {}) }))
};

const mockWindow = {
  showInputBox: mock(() => Promise.resolve("new-api-key")),
  showErrorMessage: mock(() => Promise.resolve()),
  showInformationMessage: mock(() => Promise.resolve("Set API Key"))
};

const mockLm = {
  registerChatModelProvider: mock(() => ({ dispose: mock(() => {}) }))
};

const mockVscode = {
  commands: mockCommands,
  window: mockWindow,
  lm: mockLm,
  ExtensionContext: class {},
  Disposable: class {
    dispose() {}
  }
};

mock.module("vscode", () => mockVscode);

// Import after mocking
import { activate, deactivate } from "../../src/extension";

describe("Extension", () => {
  beforeEach(() => {
    // Clear all mocks
    Object.values(mockCommands).forEach(m => m.mockClear());
    Object.values(mockWindow).forEach(m => m.mockClear());
    Object.values(mockLm).forEach(m => m.mockClear());
    mockExtensionContext.secrets.get.mockClear();
    mockExtensionContext.secrets.store.mockClear();
    mockExtensionContext.secrets.delete.mockClear();
    mockExtensionContext.subscriptions.push.mockClear();
  });

  describe("activate", () => {
    test("should register all API key commands", async () => {
      await activate(mockExtensionContext as any);

      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.anthropic.setKey", expect.any(Function));
      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.groq.setKey", expect.any(Function));
      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.gemini.setKey", expect.any(Function));
      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.openrouter.setKey", expect.any(Function));
      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.openai.setKey", expect.any(Function));
      expect(mockCommands.registerCommand).toHaveBeenCalledWith("copilot-boost-mode.anthropic.setClaudeCodeKey", expect.any(Function));
    });

    test("should retrieve API keys from secrets", async () => {
      await activate(mockExtensionContext as any);

      expect(mockExtensionContext.secrets.get).toHaveBeenCalledWith("AnthropicCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.get).toHaveBeenCalledWith("GroqCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.get).toHaveBeenCalledWith("GeminiCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.get).toHaveBeenCalledWith("OpenRouterCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.get).toHaveBeenCalledWith("OpenAICopilotBoostApiKey");
    });

    test("should register all language model providers", async () => {
      await activate(mockExtensionContext as any);

      expect(mockLm.registerChatModelProvider).toHaveBeenCalledWith("anthropic", expect.any(Object), expect.objectContaining({
        vendor: "boost",
        name: "Anthropic",
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
      }));

      expect(mockLm.registerChatModelProvider).toHaveBeenCalledWith("groq", expect.any(Object), expect.objectContaining({
        vendor: "boost",
        name: "Groq"
      }));

      expect(mockLm.registerChatModelProvider).toHaveBeenCalledWith("gemini", expect.any(Object), expect.objectContaining({
        vendor: "boost",
        name: "Gemini"
      }));

      expect(mockLm.registerChatModelProvider).toHaveBeenCalledWith("openrouter", expect.any(Object), expect.objectContaining({
        vendor: "boost",
        name: "OpenRouter"
      }));

      expect(mockLm.registerChatModelProvider).toHaveBeenCalledWith("openai", expect.any(Object), expect.objectContaining({
        vendor: "boost",
        name: "OpenAI"
      }));
    });

    test("should add disposables to subscriptions", async () => {
      await activate(mockExtensionContext as any);

      // Should have at least 11 subscriptions (6 commands + 5 providers + test commands + test runner)
      expect(mockExtensionContext.subscriptions.push).toHaveBeenCalledTimes(11);
    });
  });

  describe("deactivate", () => {
    test("should delete all API keys from secrets", () => {
      deactivate(mockExtensionContext as any);

      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("AnthropicCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("GroqCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("GeminiCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("OpenAICopilotBoostApiKey");
    });
  });
});
