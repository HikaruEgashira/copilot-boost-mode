import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";

/**
 * Integration tests for language model providers
 * Tests the complete workflow from extension activation to provider response
 */

// Import global setup
import "../setup";

// Mock the entire VS Code API for integration testing
const mockProviders = new Map<string, any>();

const mockVSCode = {
  lm: {
    registerChatProvider: mock((id: string, provider: any) => {
      mockProviders.set(id, provider);
      return { dispose: mock() };
    }),
    registerChatModelProvider: mock((id: string, provider: any, metadata?: any) => {
      mockProviders.set(id, provider);
      return { dispose: mock() };
    }),
    selectChatModels: mock(async (criteria?: any) => {
      const models = [];
      for (const [id, provider] of mockProviders) {
        if (!criteria || !criteria.vendor || criteria.vendor === "boost") {
          models.push({
            id: `boost.${id}`,
            vendor: "boost",
            family: id,
            maxInputTokens: 100000,
            provider: provider
          });
        }
      }
      return models;
    })
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
    secrets = {
      get: mock(async (key: string) => {
        // Return mock API keys for testing
        if (key.includes("anthropic")) return "mock-anthropic-key";
        if (key.includes("openai")) return "mock-openai-key";
        if (key.includes("groq")) return "mock-groq-key";
        if (key.includes("gemini")) return "mock-gemini-key";
        return "mock-api-key";
      }),
      store: mock(),
      delete: mock()
    };
    globalState = {
      get: mock(),
      update: mock()
    };
    workspaceState = {
      get: mock(),
      update: mock()
    };
  },
  workspace: {
    getConfiguration: mock((section?: string) => ({
      get: mock((key: string, defaultValue?: any) => {
        // Return default model configurations
        if (key === "modelName") {
          if (section?.includes("anthropic")) return "claude-sonnet-4-20250514";
          if (section?.includes("openai")) return "gpt-4";
          if (section?.includes("groq")) return "llama-3.3-70b-versatile";
          if (section?.includes("gemini")) return "gemini-1.5-pro";
          return defaultValue;
        }
        return defaultValue;
      }),
      update: mock(),
      has: mock(() => true)
    }))
  },
  commands: {
    registerCommand: mock(() => ({ dispose: mock() })),
    executeCommand: mock()
  },
  window: {
    showErrorMessage: mock(),
    showInformationMessage: mock(),
    createOutputChannel: mock(() => ({
      appendLine: mock(),
      show: mock(),
      dispose: mock()
    }))
  }
};

mock.module("vscode", () => mockVSCode);

// Mock AI SDK packages
mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: mock(() => (model: string) => ({ model }))
}));

mock.module("@ai-sdk/openai", () => ({
  createOpenAI: mock(() => (model: string) => ({ model }))
}));

mock.module("@ai-sdk/groq", () => ({
  createGroq: mock(() => (model: string) => ({ model }))
}));

mock.module("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mock(() => (model: string) => ({ model }))
}));

mock.module("ai", () => ({
  streamText: mock(async (config: any) => ({
    fullStream: {
      [Symbol.asyncIterator]: async function* () {
        yield { type: "text-delta", textDelta: "Hello" };
        yield { type: "text-delta", textDelta: " from " };
        yield { type: "text-delta", textDelta: config.model?.model || "AI" };
        yield { type: "finish" };
      }
    }
  }))
}));

// Mock logger
mock.module("../../src/logger", () => ({
  logger: {
    log: mock(),
    info: mock(),
    error: mock(),
    warn: mock()
  }
}));

// Import extension after mocking
import { activate } from "../../src/extension";

describe("Provider Integration Tests", () => {
  let mockContext: any;
  let activatedExtension: any;

  beforeAll(async () => {
    mockContext = new mockVSCode.ExtensionContext();
  });

  beforeEach(() => {
    mockProviders.clear();
    // Clear all mock calls
    mockVSCode.lm.registerChatModelProvider.mockClear();
    mockVSCode.lm.selectChatModels.mockClear();
  });

  test("should activate extension and register all providers", async () => {
    activatedExtension = await activate(mockContext);

    // Verify all providers are registered
    expect(mockVSCode.lm.registerChatModelProvider).toHaveBeenCalledTimes(5);

    // Verify provider IDs
    const registeredIds = mockVSCode.lm.registerChatModelProvider.mock.calls.map(
      (call: any) => call[0]
    );

    expect(registeredIds).toContain("anthropic");
    expect(registeredIds).toContain("openai");
    expect(registeredIds).toContain("groq");
    expect(registeredIds).toContain("gemini");
    expect(registeredIds).toContain("openrouter");
  });

  test("should select chat models for all providers", async () => {
    await activate(mockContext);

    const models = await mockVSCode.lm.selectChatModels({ vendor: "boost" });

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model: any) => model.vendor === "boost")).toBe(true);
    expect(models.some((model: any) => model.id.includes("anthropic"))).toBe(true);
  });

  test("should handle provider responses", async () => {
    await activate(mockContext);

    // Get a provider
    const anthropicProvider = mockProviders.get("anthropic");
    expect(anthropicProvider).toBeDefined();

    // Mock progress and cancellation token
    const mockProgress = { report: mock() };
    const mockToken = {
      isCancellationRequested: false,
      onCancellationRequested: mock(() => ({ dispose: mock() }))
    };

    // Test provider response
    await anthropicProvider.provideLanguageModelResponse(
      [{ role: 1, content: "Hello" }],
      {},
      "test-extension",
      mockProgress,
      mockToken
    );

    expect(mockProgress.report).toHaveBeenCalled();
  });

  describe("Error Handling Integration", () => {
    test("should handle missing API keys gracefully", async () => {
      // Mock missing API key
      mockContext.secrets.get = mock(async () => undefined);

      await activate(mockContext);

      const anthropicProvider = mockProviders.get("anthropic");
      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      await expect(
        anthropicProvider.provideLanguageModelResponse(
          [{ role: 1, content: "Hello" }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        )
      ).rejects.toThrow();
    });

    test("should handle malformed tool schemas", async () => {
      await activate(mockContext);

      const anthropicProvider = mockProviders.get("anthropic");
      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      // Test with malformed tools
      const malformedTools = [
        { name: "invalid_tool" } // Missing required fields
      ];

      await anthropicProvider.provideLanguageModelResponse(
        [{ role: 1, content: "Hello" }],
        { tools: malformedTools },
        "test-extension",
        mockProgress,
        mockToken
      );

      // Should not throw, should handle gracefully
      expect(mockProgress.report).toHaveBeenCalled();
    });
  });

  describe("Cross-Provider Consistency", () => {
    test("all providers should handle basic text generation", async () => {
      await activate(mockContext);

      const providerIds = ["anthropic", "openai", "groq", "gemini", "openrouter"];
      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      for (const providerId of providerIds) {
        const provider = mockProviders.get(providerId);
        expect(provider).toBeDefined();

        // Each provider should handle basic text generation
        await provider.provideLanguageModelResponse(
          [{ role: 1, content: "Hello" }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        );

        expect(mockProgress.report).toHaveBeenCalled();
        mockProgress.report.mockClear();
      }
    });

    test("all providers should support token counting", () => {
      const providerIds = ["anthropic", "openai", "groq", "gemini", "openrouter"];

      for (const providerId of providerIds) {
        const provider = mockProviders.get(providerId);
        expect(provider).toBeDefined();
        expect(typeof provider.provideTokenCount).toBe("function");
      }
    });
  });

  describe("Configuration Integration", () => {
    test("should use custom model configurations", async () => {
      // Mock custom configuration
      mockVSCode.workspace.getConfiguration = mock((section?: string) => ({
        get: mock((key: string) => {
          if (key === "modelName" && section?.includes("anthropic")) {
            return "claude-custom-model";
          }
          return undefined;
        }),
        update: mock(),
        has: mock(() => true)
      }));

      await activate(mockContext);

      const anthropicProvider = mockProviders.get("anthropic");
      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      await anthropicProvider.provideLanguageModelResponse(
        [{ role: 1, content: "Hello" }],
        {},
        "test-extension",
        mockProgress,
        mockToken
      );

      // Should use custom model configuration
      expect(mockProgress.report).toHaveBeenCalled();
    });
  });

  afterAll(() => {
    // Clean up
    if (activatedExtension?.deactivate) {
      activatedExtension.deactivate();
    }
  });
});
