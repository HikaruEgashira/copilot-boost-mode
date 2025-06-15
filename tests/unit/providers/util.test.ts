import { describe, test, expect, beforeEach, mock } from "bun:test";

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

// Mock ai module
mock.module("ai", () => ({
  jsonSchema: mock((schema) => schema)
}));

// Mock VSCode types
const mockVscode = {
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
  LanguageModelToolResultPart: class {
    constructor(public callId: string, public content: any[]) {}
  }
};

mock.module("vscode", () => mockVscode);

// Import after mocking
import {
  convertChatToCoreMessage,
  processTools,
  logToolConfiguration,
  createGeminiToolName
} from "../../../src/providers/util";

describe("Provider Utilities", () => {
  beforeEach(() => {
    Object.values(mockLogger).forEach(m => m.mockClear());
  });

  describe("convertChatToCoreMessage", () => {
    test("should convert user message with text content", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.User,
        content: [new mockVscode.LanguageModelTextPart("Hello world")]
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result).toEqual({
        role: "user",
        content: [{ type: "text", text: "Hello world" }]
      });
    });

    test("should convert assistant message with text content", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.Assistant,
        content: [new mockVscode.LanguageModelTextPart("Hello back")]
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result).toEqual({
        role: "assistant",
        content: [{ type: "text", text: "Hello back" }]
      });
    });

    test("should convert system message", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.System,
        content: [new mockVscode.LanguageModelTextPart("System prompt")]
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result).toEqual({
        role: "system",
        content: "System prompt"
      });
    });

    test("should handle tool call in assistant message", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.Assistant,
        content: [
          new mockVscode.LanguageModelTextPart("I'll help you"),
          new mockVscode.LanguageModelToolCallPart("search", '{"query": "test"}', "call_123")
        ]
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result).toEqual({
        role: "assistant",
        content: [
          { type: "text", text: "I'll help you" },
          {
            type: "tool-call",
            args: { query: "test" },
            toolName: "search",
            toolCallId: "call_123"
          }
        ]
      });
    });

    test("should handle invalid JSON in tool call", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.Assistant,
        content: [
          new mockVscode.LanguageModelToolCallPart("search", "invalid json", "call_123")
        ]
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result.role).toBe("assistant");
      expect(result.content[0]).toEqual({
        type: "tool-call",
        args: "invalid json",
        toolName: "search",
        toolCallId: "call_123"
      });
      expect(mockLogger.error).toHaveBeenCalledWith("Skipping tool call argument parsing");
    });

    test("should handle empty message content", () => {
      const message = {
        role: mockVscode.LanguageModelChatMessageRole.User,
        content: []
      };

      const result = convertChatToCoreMessage(message as any);

      expect(result).toEqual({
        role: "user",
        content: "[]"
      });
    });
  });

  describe("processTools", () => {
    test("should process tools correctly", () => {
      const options = {
        tools: [
          {
            name: "search",
            description: "Search for information",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string" }
              }
            }
          }
        ]
      };

      const result = processTools(options as any, "TestProvider");

      expect(result.hasTools).toBe(true);
      expect(result.tools).toHaveProperty("search");
      expect(result.tools.search).toEqual({
        parameters: options.tools[0].inputSchema,
        description: "Search for information"
      });
    });

    test("should handle tools without input schema", () => {
      const options = {
        tools: [
          {
            name: "simple_tool",
            description: "A simple tool"
          }
        ]
      };

      const result = processTools(options as any, "TestProvider");

      expect(result.hasTools).toBe(true);
      expect(result.tools.simple_tool).toEqual({
        parameters: { type: "object", properties: {} },
        description: "A simple tool"
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[TestProvider] Tool 'simple_tool' has no input schema, providing default empty object schema"
      );
    });

    test("should apply tool name transformation", () => {
      const options = {
        tools: [
          {
            name: "complex-tool-name",
            description: "Complex tool",
            inputSchema: { type: "object", properties: {} }
          }
        ]
      };

      const transformFn = (name: string) => name.replace(/-/g, "_");
      const result = processTools(options as any, "TestProvider", transformFn);

      expect(result.hasTools).toBe(true);
      expect(result.tools).toHaveProperty("complex_tool_name");
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[TestProvider] Tool name converted: "complex-tool-name" -> "complex_tool_name"'
      );
    });

    test("should handle no tools", () => {
      const options = {};

      const result = processTools(options as any, "TestProvider");

      expect(result.hasTools).toBe(false);
      expect(result.tools).toEqual({});
    });
  });

  describe("logToolConfiguration", () => {
    test("should log tool configuration", () => {
      const tools = {
        search: { parameters: {}, description: "Search" },
        analyze: { parameters: {}, description: "Analyze" }
      };

      logToolConfiguration("TestProvider", true, tools, "test-model", "auto", { temp: 0.7 });

      expect(mockLogger.log).toHaveBeenCalledWith(
        "[TestProvider] streamText config: modelName=test-model, toolChoice=auto, temp=0.7"
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "[TestProvider] Tools available: true, tool count: 2"
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "[TestProvider] Tool names: search, analyze"
      );
    });

    test("should log when no tools available", () => {
      logToolConfiguration("TestProvider", false, {}, "test-model", undefined);

      expect(mockLogger.log).toHaveBeenCalledWith(
        "[TestProvider] streamText config: modelName=test-model, toolChoice=undefined"
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        "[TestProvider] Tools available: false, tool count: 0"
      );
    });
  });

  describe("createGeminiToolName", () => {
    test("should sanitize tool names for Gemini", () => {
      expect(createGeminiToolName("search-data")).toBe("search_data");
      expect(createGeminiToolName("complex@tool#name")).toBe("complex_tool_name");
      expect(createGeminiToolName("123invalid")).toBe("_123invalid");
    });

    test("should handle valid tool names", () => {
      expect(createGeminiToolName("valid_tool_name")).toBe("valid_tool_name");
      expect(createGeminiToolName("tool123")).toBe("tool123");
      expect(createGeminiToolName("_underscore_start")).toBe("_underscore_start");
    });

    test("should truncate long tool names", () => {
      const longName = "a".repeat(100);
      const result = createGeminiToolName(longName);
      expect(result.length).toBe(64);
    });

    test("should handle empty and invalid names", () => {
      expect(createGeminiToolName("")).toBe("_");
      expect(createGeminiToolName("@#$%")).toBe("_____");
    });
  });
});
