import { mock } from "bun:test";

/**
 * Comprehensive AI SDK mock for testing streaming responses
 * Provides realistic simulation of AI SDK's streamText API
 */

export interface MockStreamResponse {
  type: "text-delta" | "tool-call" | "tool-result" | "finish" | "error";
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  error?: Error;
}

export class MockAISDK {
  private static responses: MockStreamResponse[] = [];
  private static shouldError = false;

  static setMockResponses(responses: MockStreamResponse[]) {
    this.responses = responses;
  }

  static setError(error: boolean) {
    this.shouldError = error;
  }

  static reset() {
    this.responses = [];
    this.shouldError = false;
  }

  static createMockStreamText() {
    return mock((_config: any) => {
      if (this.shouldError) {
        throw new Error("Mock API Error");
      }

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const response of MockAISDK.responses) {
            yield response;
          }
        }
      };

      return {
        fullStream: mockStream,
        textStream: async function* () {
          for (const response of MockAISDK.responses) {
            if (response.type === "text-delta" && response.textDelta) {
              yield response.textDelta;
            }
          }
        }(),
        toolCalls: MockAISDK.responses
          .filter(r => r.type === "tool-call")
          .map(r => ({
            toolCallId: r.toolCallId,
            toolName: r.toolName,
            args: r.toolArgs
          })),
        toolResults: MockAISDK.responses
          .filter(r => r.type === "tool-result")
          .map(r => ({
            toolCallId: r.toolCallId,
            result: r.toolResult
          })),
        finishReason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      };
    });
  }
}

// Predefined mock responses for common scenarios
export const MOCK_RESPONSES = {
  SIMPLE_TEXT: [
    { type: "text-delta" as const, textDelta: "Hello" },
    { type: "text-delta" as const, textDelta: " world" },
    { type: "finish" as const }
  ],

  WITH_TOOLS: [
    { type: "text-delta" as const, textDelta: "Let me help you with that." },
    {
      type: "tool-call" as const,
      toolCallId: "call_123",
      toolName: "get_weather",
      toolArgs: { location: "Tokyo" }
    },
    {
      type: "tool-result" as const,
      toolCallId: "call_123",
      toolResult: { temperature: 25, condition: "sunny" }
    },
    { type: "text-delta" as const, textDelta: "The weather in Tokyo is 25°C and sunny." },
    { type: "finish" as const }
  ],

  ERROR_RESPONSE: [
    { type: "error" as const, error: new Error("API Error") }
  ]
};
