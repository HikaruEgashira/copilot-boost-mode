import { describe, test, expect, beforeEach, mock } from "bun:test";
import { MockAISDK, MOCK_RESPONSES } from "../mocks/ai-sdk-mock";
import { MockVSCode } from "../mocks/vscode-mock";

/**
 * Base test suite for all AI provider implementations
 * Provides consistent testing patterns across providers
 */

export interface ProviderTestConfig {
  ProviderClass: any;
  providerName: string;
  defaultModel: string;
  sdkPackage: string;
  createFunction: string;
}

export function createProviderTests(config: ProviderTestConfig) {
  const { ProviderClass, providerName, defaultModel, sdkPackage, createFunction } = config;

  describe(`${providerName}Provider`, () => {
    let provider: any;
    let mockCreateProvider: any;
    let mockStreamText: any;
    let mockProgress: any;
    let mockCancellationToken: any;

    // Mock utility functions
    const mockProcessTools = mock((tools: any) => ({
      tools: tools || {},
      hasTools: Boolean(tools && tools.length > 0)
    }));

    const mockConvertChatToCoreMessage = mock((message: any) => ({
      role: message.role === 1 ? "user" : "assistant",
      content: typeof message.content === "string" ? message.content : "test content"
    }));

    const mockLogToolConfiguration = mock(() => {});

    beforeEach(() => {
      // Reset all mocks
      MockAISDK.reset();
      MockVSCode.reset();
      mockProcessTools.mockClear();
      mockConvertChatToCoreMessage.mockClear();
      mockLogToolConfiguration.mockClear();

      // Create fresh mocks
      mockCreateProvider = mock(() => (modelName: string) => ({ model: modelName }));
      mockStreamText = MockAISDK.createMockStreamText();

      mockProgress = {
        report: mock()
      };

      mockCancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      // Mock the SDK packages
      mock.module(sdkPackage, () => ({
        [createFunction]: mockCreateProvider
      }));

      mock.module("ai", () => ({
        streamText: mockStreamText
      }));

      // Mock provider utilities
      mock.module("../../../src/providers/util", () => ({
        convertChatToCoreMessage: mockConvertChatToCoreMessage,
        processTools: mockProcessTools,
        logToolConfiguration: mockLogToolConfiguration
      }));
    });

    describe("Constructor", () => {
      test("should initialize with API key", () => {
        provider = new ProviderClass("test-api-key");
        expect(provider.apiKey).toBe("test-api-key");
      });

      test("should initialize without API key", () => {
        provider = new ProviderClass(undefined);
        expect(provider.apiKey).toBeUndefined();
      });
    });

    describe("API Key Validation", () => {
      test("should throw error when no API key is set", async () => {
        provider = new ProviderClass(undefined);
        MockVSCode.setConfiguration(`copilot-boost-mode.${providerName.toLowerCase()}`, {
          modelName: defaultModel
        });

        const messages = [{ role: 1, content: "Hello" }];

        await expect(
          provider.provideLanguageModelResponse(
            messages,
            {},
            "test-extension",
            mockProgress,
            mockCancellationToken
          )
        ).rejects.toThrow();
      });
    });

    describe("Streaming Response", () => {
      beforeEach(() => {
        provider = new ProviderClass("test-api-key");
        MockVSCode.setConfiguration(`copilot-boost-mode.${providerName.toLowerCase()}`, {
          modelName: defaultModel
        });
      });

      test("should handle text streaming", async () => {
        MockAISDK.setMockResponses(MOCK_RESPONSES.SIMPLE_TEXT);

        const messages = [{ role: 1, content: "Hello" }];
        await provider.provideLanguageModelResponse(
          messages,
          {},
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockProgress.report).toHaveBeenCalled();
        expect(mockStreamText).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.anything(),
            messages: expect.any(Array)
          })
        );
      });

      test("should handle tool calls", async () => {
        MockAISDK.setMockResponses(MOCK_RESPONSES.WITH_TOOLS);

        const messages = [{ role: 1, content: "What's the weather?" }];
        const tools = [{
          name: "get_weather",
          description: "Get weather information",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" }
            }
          }
        }];

        await provider.provideLanguageModelResponse(
          messages,
          { tools },
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockStreamText).toHaveBeenCalled();
      });

      test("should handle cancellation", async () => {
        MockAISDK.setMockResponses(MOCK_RESPONSES.SIMPLE_TEXT);

        // Mock cancellation
        mockCancellationToken.isCancellationRequested = true;

        const messages = [{ role: 1, content: "Hello" }];

        // Test should complete without throwing since cancellation is handled internally
        await provider.provideLanguageModelResponse(
          messages,
          {},
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockCancellationToken.onCancellationRequested).toHaveBeenCalled();
      });

      test("should handle API errors", async () => {
        MockAISDK.setError(true);

        const messages = [{ role: 1, content: "Hello" }];

        await expect(
          provider.provideLanguageModelResponse(
            messages,
            {},
            "test-extension",
            mockProgress,
            mockCancellationToken
          )
        ).rejects.toThrow();
      });
    });

    describe("Configuration", () => {
      beforeEach(() => {
        provider = new ProviderClass("test-api-key");
      });

      test("should use configured model", async () => {
        const customModel = "custom-model";
        MockVSCode.setConfiguration(`copilot-boost-mode.${providerName.toLowerCase()}`, {
          modelName: customModel
        });

        MockAISDK.setMockResponses(MOCK_RESPONSES.SIMPLE_TEXT);

        const messages = [{ role: 1, content: "Hello" }];
        await provider.provideLanguageModelResponse(
          messages,
          {},
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockStreamText).toHaveBeenCalled();
      });

      test("should use default model when not configured", async () => {
        MockVSCode.setConfiguration(`copilot-boost-mode.${providerName.toLowerCase()}`, {});

        MockAISDK.setMockResponses(MOCK_RESPONSES.SIMPLE_TEXT);

        const messages = [{ role: 1, content: "Hello" }];
        await provider.provideLanguageModelResponse(
          messages,
          {},
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockStreamText).toHaveBeenCalled();
      });
    });

    describe("Progress Reporting", () => {
      beforeEach(() => {
        provider = new ProviderClass("test-api-key");
        MockVSCode.setConfiguration(`copilot-boost-mode.${providerName.toLowerCase()}`, {
          modelName: defaultModel
        });
      });

      test("should report progress during streaming", async () => {
        MockAISDK.setMockResponses(MOCK_RESPONSES.SIMPLE_TEXT);

        const messages = [{ role: 1, content: "Hello" }];
        await provider.provideLanguageModelResponse(
          messages,
          {},
          "test-extension",
          mockProgress,
          mockCancellationToken
        );

        expect(mockProgress.report).toHaveBeenCalled();
      });
    });
  });
}

/**
 * Provider-specific test configurations
 */
export const PROVIDER_CONFIGS: { [key: string]: ProviderTestConfig } = {
  anthropic: {
    ProviderClass: null, // Will be set when imported
    providerName: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    sdkPackage: "@ai-sdk/anthropic",
    createFunction: "createAnthropic"
  },

  openai: {
    ProviderClass: null,
    providerName: "OpenAI",
    defaultModel: "gpt-4",
    sdkPackage: "@ai-sdk/openai",
    createFunction: "createOpenAI"
  },

  groq: {
    ProviderClass: null,
    providerName: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    sdkPackage: "@ai-sdk/groq",
    createFunction: "createGroq"
  },

  gemini: {
    ProviderClass: null,
    providerName: "Gemini",
    defaultModel: "gemini-1.5-pro",
    sdkPackage: "@ai-sdk/google",
    createFunction: "createGoogleGenerativeAI"
  },

  openrouter: {
    ProviderClass: null,
    providerName: "OpenRouter",
    defaultModel: "anthropic/claude-3.5-sonnet",
    sdkPackage: "@ai-sdk/openai",
    createFunction: "createOpenAI"
  }
};
