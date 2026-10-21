import { MockVSCode } from "../mocks/vscode-mock";
import { providerContext } from "../utils/provider-test-base";
import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock AI SDK functions
const mockStreamText = mock(() => ({
  fullStream: (async function* () {
    yield { type: "text-delta", text: "Hello" };
    yield { type: "text-delta", text: " from" };
    yield { type: "text-delta", text: " AI" };
  })(),
  toolCalls: [],
  toolResults: []
}));

const mockCreateAnthropic = mock(() => (model: string) => ({model}));

mock.module("ai", () => ({
  streamText: mockStreamText,
  jsonSchema: mock(schema => schema)
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: mockCreateAnthropic
}));

// Mock other providers
mock.module("@ai-sdk/openai", () => ({ createOpenAI: mock(() => ({})) }));
mock.module("@ai-sdk/google", () => ({ createGoogle: mock(() => ({})) }));
mock.module("@ai-sdk/groq", () => ({ createGroq: mock(() => ({})) }));

// Mock VSCode API
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

const mockVscode = {
  ...MockVSCode.createMockVSCode(),
  window: {
    createOutputChannel: mock(() => ({
      appendLine: mock(() => {}),
      show: mock(() => {}),
      hide: mock(() => {}),
      dispose: mock(() => {})
    })),
    showErrorMessage: mock(() => Promise.resolve()),
    showInformationMessage: mock(() => Promise.resolve())
  },
  workspace: {
    getConfiguration: mock(() => mockWorkspaceConfig)
  },
  commands: {
    executeCommand: mock(() => Promise.resolve())
  },
  LanguageModelChatMessage: class {
    constructor(public role: number, public content: any) {
      if (typeof content === "string") this.content = [new mockVscode.LanguageModelTextPart(content)];
    }
  },
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
    System: 0
  },
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
  LanguageModelToolCallPart: class {
    constructor(public name: string, public input: string, public callId: string) {}
  },
  Progress: class {},
  CancellationToken: class {}
};

mock.module("vscode", () => mockVscode);

describe("Provider Workflow Integration Tests", () => {
  beforeEach(() => {
    mockStreamText.mockClear();
    mockCreateAnthropic.mockClear();
    mockProgress.report.mockClear();
    mockWorkspaceConfig.get.mockClear();
    Object.values(mockVscode.window).forEach(m => {
      if (typeof m === 'function') m.mockClear();
    });
  });

  describe("End-to-End Chat Flow", () => {
    test("should complete full chat flow with Anthropic provider", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Hello, how are you?")]
        )
      ];

      const options = {
        justification: "Testing the provider",
        tools: []
      };

      // Mock successful response
      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "I'm doing well" };
          yield { type: "text-delta", text: ", thank you" };
          yield { type: "text-delta", text: " for asking!" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      // Verify API was called
      expect(mockCreateAnthropic).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: "test-api-key"
      }));

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Object),
          messages: expect.any(Array)
        })
      );

      // Verify progress was reported
      expect(mockProgress.report).toHaveBeenCalledTimes(3);
      expect(mockProgress.report).toHaveBeenCalledWith({ index: 0, part: new mockVscode.LanguageModelTextPart("I'm doing well") });
      expect(mockProgress.report).toHaveBeenCalledWith({ index: 0, part: new mockVscode.LanguageModelTextPart(", thank you") });
      expect(mockProgress.report).toHaveBeenCalledWith({ index: 0, part: new mockVscode.LanguageModelTextPart(" for asking!") });
    });

    test("should handle tool calling workflow", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Search for information about cats")]
        )
      ];

      const options = {
        justification: "Testing tool calling",
        toolMode: mockVscode.LanguageModelChatToolMode.Auto,
        tools: [
          {
            name: "search",
            description: "Search for information",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string" }
              },
              required: ["query"]
            }
          }
        ]
      };

      // Mock response with tool calls
      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "I'll search for that information." };
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      // Verify tools were processed
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            search: expect.objectContaining({
              description: "Search for information",
              inputSchema: expect.any(Object)
            })
          }),
          toolChoice: "auto"
        })
      );
    });

    test("should handle conversation with multiple messages", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Hello")]
        ),
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.Assistant,
          [new mockVscode.LanguageModelTextPart("Hi there! How can I help you?")]
        ),
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Tell me a joke")]
        )
      ];

      const options = {
        justification: "Testing conversation flow"
      };

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Why did the cat" };
          yield { type: "text-delta", text: " sit on the computer?" };
          yield { type: "text-delta", text: " Because it wanted to keep an eye on the mouse!" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        options as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      // Verify all messages were processed
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "user" }),
            expect.objectContaining({ role: "assistant" }),
            expect.objectContaining({ role: "user" })
          ])
        })
      );
    });

    test("should handle cancellation during streaming", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Tell me a long story")]
        )
      ];

      // Create a cancellation token that becomes cancelled
      const cancelToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock((callback) => {
          setTimeout(() => {
            cancelToken.isCancellationRequested = true;
            callback();
          }, 10);
          return { dispose: mock(() => {}) };
        })
      };

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Once upon a time" };
          await new Promise(resolve => setTimeout(resolve, 20)); // Delay to allow cancellation
          yield { type: "text-delta", text: " there was a cat" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        {} as any,
        "test-extension",
        mockProgress as any,
        cancelToken as any
      );

      // Should handle cancellation gracefully
      expect(cancelToken.onCancellationRequested).toHaveBeenCalled();
    });

    test("should handle API errors gracefully", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Hello")]
        )
      ];

      // Mock API error
      mockStreamText.mockImplementationOnce(() => { throw new Error("API quota exceeded"); });

      expect(provider.provideLanguageModelResponse(
        messages as any,
        {} as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      )).rejects.toThrow("API quota exceeded");
    });

    test("should handle empty responses", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Say nothing")]
        )
      ];

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          // Empty stream
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        {} as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      // Should handle empty response without crashing
      expect(mockProgress.report).not.toHaveBeenCalled();
    });
  });

  describe("Configuration Integration", () => {
    test("should use custom model configuration", async () => {
      const { AnthropicProvider } = await import("../../src/providers/anthropic");

      mockWorkspaceConfig.get.mockReturnValueOnce("claude-sonnet-4-20250514");

      const provider = new AnthropicProvider(providerContext("test-api-key") as any);

      const messages = [
        new mockVscode.LanguageModelChatMessage(
          mockVscode.LanguageModelChatMessageRole.User,
          [new mockVscode.LanguageModelTextPart("Hello")]
        )
      ];

      mockStreamText.mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello!" };
        })(),
        toolCalls: [],
        toolResults: []
      });

      await provider.provideLanguageModelResponse(
        messages as any,
        {} as any,
        "test-extension",
        mockProgress as any,
        mockCancellationToken as any
      );

      expect(mockVscode.workspace.getConfiguration).toHaveBeenCalledWith("copilot-boost-mode.anthropic");
      expect(mockWorkspaceConfig.get).toHaveBeenCalledWith("modelName");
    });
  });
});
