import { providerContext } from "../../utils/provider-test-base";
import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock dependencies
const mockCreateAnthropic = mock(() => (name: string) => ({modelId:name}));
const mockStreamText = mock(() => ({
  fullStream: (async function* () {
    yield { type: "text-delta", text: "Hello" };
    yield { type: "text-delta", text: " world" };
  })(),
  toolCalls: [],
  toolResults: []
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: mockCreateAnthropic
}));

mock.module("ai", () => ({
  streamText: mockStreamText
}));

// Mock util functions
const mockConvertChatToModelMessage = mock(() => ({ role: "user", content: "test" }));
const mockProcessTools = mock(() => ({ tools: {}, hasTools: false }));
const mockLogToolConfiguration = mock(() => {});

mock.module("../../../src/providers/util", () => ({
  convertChatToModelMessage: mockConvertChatToModelMessage,
  processTools: mockProcessTools,
  logToolConfiguration: mockLogToolConfiguration
}));

// Mock logger
const mockLogger = {
  log: mock(() => {}),
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {})
};

mock.module("../../../src/logger", () => ({
  logger: mockLogger
}));

// Mock vscode
const mockProgress = {
  report: mock(() => {})
};

const mockCancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: mock(() => ({ dispose: mock(() => {}) }))
};

const mockWorkspaceConfig = {
  get: mock(() => "claude-sonnet-4-20250514")
};

const mockCommands = {
  executeCommand: mock(() => Promise.resolve())
};

const mockWindow = {
  showErrorMessage: mock(() => Promise.resolve("Set API Key")),
  showInformationMessage: mock(() => Promise.resolve("Reload Window"))
};

const mockWorkspace = {
  getConfiguration: mock(() => mockWorkspaceConfig)
};

const mockVscode = {
  commands: mockCommands,
  window: mockWindow,
  workspace: mockWorkspace,
  LanguageModelTextPart: class { constructor(public value: string) {} },
  LanguageModelChatMessage: class {
    constructor(public role: number, public content: string) {}
  },
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
    System: 0
  },
  Progress: class {},
  CancellationToken: class {},
  ChatResponseFragment2: class {}
};

mock.module("vscode", () => mockVscode);

// Import after mocking
import { AnthropicProvider } from "../../../src/providers/anthropic";

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    // Clear all mocks
    mockCreateAnthropic.mockClear();
    mockStreamText.mockClear();
    mockConvertChatToModelMessage.mockClear();
    mockProcessTools.mockClear();
    mockLogToolConfiguration.mockClear();
    Object.values(mockLogger).forEach(m => m.mockClear());
    mockProgress.report.mockClear();
    mockWorkspaceConfig.get.mockClear();
    mockCommands.executeCommand.mockClear();
    mockWindow.showErrorMessage.mockClear();
    mockWindow.showInformationMessage.mockClear();
    mockWorkspace.getConfiguration.mockClear();
  });

  describe("constructor", () => {
    test("should initialize with API key", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);
      expect(await (provider as any).context.secrets.get("AnthropicCopilotBoostApiKey")).toBe("test-api-key");
    });

    test("should initialize without API key", async () => {
      provider = new AnthropicProvider(providerContext(undefined) as any);
      expect(await (provider as any).context.secrets.get("AnthropicCopilotBoostApiKey")).toBeUndefined();
    });
  });

  describe("provideLanguageModelResponse", () => {
    test("should throw error when no API key is set", async () => {
      provider = new AnthropicProvider(providerContext(undefined) as any);

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      try {
        await provider.provideLanguageModelResponse(
          messages as any,
          options as any,
          "test-extension",
          mockProgress as any,
          mockCancellationToken as any
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
          "No API key set. Please set your API key in the settings.",
          "Set API Key"
        );
      }
    });

    test("should get model configuration", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      // Mock successful streaming response
      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockWorkspace.getConfiguration).toHaveBeenCalledWith("copilot-boost-mode.anthropic");
      expect(mockWorkspaceConfig.get).toHaveBeenCalledWith("modelName");
    });

    test("should use default model when config is not set", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);
      mockWorkspaceConfig.get.mockReturnValueOnce("claude-sonnet-4-20250514");

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ modelId: expect.stringContaining("claude") })
        })
      );
    });

    test("should convert messages using util function", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      const messages = [
        new mockVscode.LanguageModelChatMessage(1, "Hello"),
        new mockVscode.LanguageModelChatMessage(2, "Hi there")
      ];
      const options = {};

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockConvertChatToModelMessage).toHaveBeenCalledTimes(2);
    });

    test("should process tools when provided", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      mockProcessTools.mockReturnValueOnce({
        tools: { search: { parameters: {}, description: "Search" } },
        hasTools: true
      });

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {
        tools: [{ name: "search", description: "Search", inputSchema: {} }]
      };

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockProcessTools).toHaveBeenCalledWith(options, "Anthropic");
      expect(mockLogToolConfiguration).toHaveBeenCalled();
    });

    test("should report progress during streaming", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
          yield { type: "text-delta", text: " world" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockProgress.report).toHaveBeenCalledTimes(2);
      expect(mockProgress.report).toHaveBeenCalledWith({ index: 0, part: new mockVscode.LanguageModelTextPart("Hello") });
      expect(mockProgress.report).toHaveBeenCalledWith({ index: 0, part: new mockVscode.LanguageModelTextPart(" world") });
    });

    test("should handle cancellation", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const cancelledToken = {
        isCancellationRequested: true,
        onCancellationRequested: mock(() => ({ dispose: mock(() => {}) }))
      };

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      // Should handle cancellation gracefully
      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        cancelledToken as any
      );

      // The exact behavior depends on implementation, but it should not crash
    });

    test("should handle streaming errors", async () => {
      provider = new AnthropicProvider(providerContext("test-api-key") as any);

      mockStreamText.mockImplementationOnce(() => { throw new Error("API Error"); });

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];
      const options = {};

      try {
        await provider.provideLanguageModelResponse(
          messages as any,
          options as any,
          "test-extension",
          mockProgress as any,
          mockCancellationToken as any
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("API Error");
      }
    });
  });

  describe("API key error handling", () => {
    test("should show API key setup flow", async () => {
      provider = new AnthropicProvider(providerContext(undefined) as any);

      const messages = [new mockVscode.LanguageModelChatMessage(1, "Hello")];

      expect(provider.provideLanguageModelResponse(
        messages as any,
        {} as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      )).rejects.toThrow("No API key set. Please set your API key in the settings.");
    });
  });
});
