import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock all external dependencies before imports
const mockCreateAnthropic = mock(() => ({}));
const mockCreateOpenAI = mock(() => ({}));
const mockCreateGoogle = mock(() => ({}));
const mockCreateGroq = mock(() => ({}));

mock.module("@ai-sdk/anthropic", () => ({ createAnthropic: mockCreateAnthropic }));
mock.module("@ai-sdk/openai", () => ({ createOpenAI: mockCreateOpenAI }));
mock.module("@ai-sdk/google", () => ({ createGoogle: mockCreateGoogle }));
mock.module("@ai-sdk/groq", () => ({ createGroq: mockCreateGroq }));
mock.module("ai", () => ({ streamText: mock(() => Promise.resolve({})), jsonSchema: mock(s => s) }));
mock.module("node:child_process", () => ({ execSync: mock(() => '{}') }));

// Mock comprehensive VSCode API
const mockExtensionContext = {
  secrets: {
    get: mock(() => Promise.resolve("test-key")),
    store: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve())
  },
  subscriptions: [],
  extensionPath: "/test/path",
  globalState: {
    get: mock(() => undefined),
    update: mock(() => Promise.resolve())
  },
  workspaceState: {
    get: mock(() => undefined),
    update: mock(() => Promise.resolve())
  }
};

const mockDisposable = { dispose: mock(() => {}) };

const mockVscode = {
  commands: {
    registerCommand: mock(() => mockDisposable)
  },
  window: {
    createOutputChannel: mock(() => ({
      appendLine: mock(() => {}),
      show: mock(() => {}),
      hide: mock(() => {}),
      dispose: mock(() => {})
    })),
    showInputBox: mock(() => Promise.resolve("test-input")),
    showErrorMessage: mock(() => Promise.resolve()),
    showInformationMessage: mock(() => Promise.resolve()),
    showWarningMessage: mock(() => Promise.resolve())
  },
  workspace: {
    getConfiguration: mock(() => ({
      get: mock(() => "default-model"),
      update: mock(() => Promise.resolve())
    }))
  },
  lm: {
    registerChatModelProvider: mock(() => mockDisposable),
    selectChatModels: mock(() => Promise.resolve([]))
  },
  LanguageModelChatMessage: class {
    constructor(public role: number, public content: string) {}
  },
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
    System: 0
  },
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
  ExtensionContext: class {},
  Disposable: class {
    dispose() {}
  }
};

mock.module("vscode", () => mockVscode);

describe("Extension Integration Tests", () => {
  beforeEach(() => {
    // Reset mocks
    mockExtensionContext.subscriptions.length = 0;
    Object.values(mockVscode.commands).forEach(m => m.mockClear());
    Object.values(mockVscode.window).forEach(m => {
      if (typeof m === 'function') m.mockClear();
    });
    Object.values(mockVscode.lm).forEach(m => m.mockClear());
    mockExtensionContext.secrets.get.mockClear();
    mockExtensionContext.secrets.store.mockClear();
    mockExtensionContext.secrets.delete.mockClear();
  });

  describe("Full Extension Activation", () => {
    test("should activate extension with all providers", async () => {
      // Import extension after mocking
      const { activate } = await import("../../src/extension");

      await activate(mockExtensionContext as any);

      // Verify all commands are registered
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.anthropic.setKey",
        expect.any(Function)
      );
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.groq.setKey",
        expect.any(Function)
      );
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.gemini.setKey",
        expect.any(Function)
      );
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.openrouter.setKey",
        expect.any(Function)
      );
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.openai.setKey",
        expect.any(Function)
      );
      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.anthropic.setClaudeCodeKey",
        expect.any(Function)
      );

      // Verify all providers are registered
      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledWith(
        "anthropic",
        expect.any(Object),
        expect.objectContaining({
          vendor: "boost",
          name: "Anthropic",
          family: "boost"
        })
      );

      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledWith(
        "groq",
        expect.any(Object),
        expect.objectContaining({
          vendor: "boost",
          name: "Groq"
        })
      );

      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledWith(
        "gemini",
        expect.any(Object),
        expect.objectContaining({
          vendor: "boost",
          name: "Gemini"
        })
      );

      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledWith(
        "openrouter",
        expect.any(Object),
        expect.objectContaining({
          vendor: "boost",
          name: "OpenRouter"
        })
      );

      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledWith(
        "openai",
        expect.any(Object),
        expect.objectContaining({
          vendor: "boost",
          name: "OpenAI"
        })
      );

      // Verify disposables are tracked
      expect(mockExtensionContext.subscriptions.length).toBeGreaterThan(0);
    });

    test("should handle missing API keys gracefully", async () => {
      mockExtensionContext.secrets.get = mock(() => Promise.resolve(undefined));

      const { activate } = await import("../../src/extension");

      // Should not throw when API keys are missing
      expect(activate(mockExtensionContext as any)).resolves.not.toThrow();

      // Should still register providers (they handle missing keys internally)
      expect(mockVscode.lm.registerChatModelProvider).toHaveBeenCalledTimes(5);
    });

    test("should properly clean up on deactivation", async () => {
      const { deactivate } = await import("../../src/extension");

      deactivate(mockExtensionContext as any);

      // Verify all API keys are deleted
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("AnthropicCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("GroqCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("GeminiCopilotBoostApiKey");
      expect(mockExtensionContext.secrets.delete).toHaveBeenCalledWith("OpenAICopilotBoostApiKey");
    });
  });

  describe("Command Registration and Execution", () => {
    test("should register and execute API key setting commands", async () => {
      const { activate } = await import("../../src/extension");

      await activate(mockExtensionContext as any);

      // Get the registered command handler for Anthropic
      const anthropicHandler = mockVscode.commands.registerCommand.mock.calls
        .find(call => call[0] === "copilot-boost-mode.anthropic.setKey")?.[1];

      expect(anthropicHandler).toBeDefined();

      // Execute the command
      (mockVscode.window.showInputBox as any).mockImplementationOnce(() => Promise.resolve("new-api-key"));
      await anthropicHandler!();

      expect(mockVscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: "Enter your API Key"
      });
      expect(mockExtensionContext.secrets.store).toHaveBeenCalledWith(
        "AnthropicCopilotBoostApiKey",
        "new-api-key"
      );
    });

    test("should handle cancelled API key input", async () => {
      const { activate } = await import("../../src/extension");

      await activate(mockExtensionContext as any);

      const anthropicHandler = mockVscode.commands.registerCommand.mock.calls
        .find(call => call[0] === "copilot-boost-mode.anthropic.setKey")?.[1];

      // Simulate user cancelling input
      (mockVscode.window.showInputBox as any).mockImplementationOnce(() => Promise.resolve(undefined));
      mockExtensionContext.secrets.get = mock(() => Promise.resolve("existing-key"));

      const result = await anthropicHandler!();

      expect(result).toBe("existing-key");
      expect(mockExtensionContext.secrets.store).not.toHaveBeenCalled();
    });
  });

  describe("Provider Integration", () => {
    test("should create providers with correct configuration", async () => {
      const { activate } = await import("../../src/extension");

      await activate(mockExtensionContext as any);

      // Verify all provider types are created
      const providerRegistrations = mockVscode.lm.registerChatModelProvider.mock.calls;

      expect(providerRegistrations).toHaveLength(5);

      // Check each provider configuration
      const anthropicConfig = providerRegistrations.find(call => call[0] === "anthropic")?.[2];
      expect(anthropicConfig).toBeDefined();
      expect(anthropicConfig).toMatchObject({
        vendor: "boost",
        name: "Anthropic",
        family: "boost",
        maxInputTokens: expect.any(Number),
        maxOutputTokens: expect.any(Number),
        isDefault: expect.any(Boolean),
        isUserSelectable: expect.any(Boolean),
        capabilities: expect.any(Object)
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle secrets API errors", async () => {
      mockExtensionContext.secrets.get.mockRejectedValue(new Error("Secrets API error"));

      const { activate } = await import("../../src/extension");

      // Should handle secrets errors gracefully
      await expect(activate(mockExtensionContext as any)).rejects.toThrow("Secrets API error");
    });

    test("should handle provider registration errors", async () => {
      mockVscode.lm.registerChatModelProvider.mockImplementationOnce(() => {
        throw new Error("Provider registration failed");
      });

      const { activate } = await import("../../src/extension");

      // Should handle provider registration errors
      await expect(activate(mockExtensionContext as any)).rejects.toThrow("Provider registration failed");
    });
  });
});
