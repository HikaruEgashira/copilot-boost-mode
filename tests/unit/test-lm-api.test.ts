import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock VSCode API
const mockOutputChannel = {
  appendLine: mock(() => {}),
  show: mock(() => {}),
  hide: mock(() => {}),
  dispose: mock(() => {}),
  name: "test-channel"
};

const mockLanguageModelChat = {
  name: "Test Model",
  id: "test-model-id",
  vendor: "test-vendor",
  family: "test-family",
  sendRequest: mock(() => ({
    text: (async function* () {
      yield "Hello";
      yield " from";
      yield " test model";
    })()
  }))
};

const mockVscode = {
  window: {
    createOutputChannel: mock(() => mockOutputChannel),
    showWarningMessage: mock(() => Promise.resolve()),
    showInformationMessage: mock(() => Promise.resolve()),
    showErrorMessage: mock(() => Promise.resolve())
  },
  lm: {
    selectChatModels: mock(() => Promise.resolve([mockLanguageModelChat])),
    registerChatModelProvider: mock(() => ({ dispose: mock(() => {}) }))
  },
  commands: {
    registerCommand: mock(() => ({ dispose: mock(() => {}) }))
  },
  LanguageModelChatMessage: class {
    constructor(public role: number, public content: string) {}
  },
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
    System: 0
  },
  CancellationTokenSource: class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: mock(() => ({ dispose: mock(() => {}) }))
    };
    cancel = mock(() => {});
    dispose = mock(() => {});
  }
};

mock.module("vscode", () => mockVscode);

// Mock logger
const mockLogger = {
  log: mock(() => {}),
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {})
};

mock.module("../../src/logger", () => ({
  logger: mockLogger
}));

describe("Test LM API", () => {
  beforeEach(() => {
    // Clear all mocks
    Object.values(mockLogger).forEach(m => m.mockClear());
    Object.values(mockVscode.window).forEach(m => {
      if (typeof m === 'function') m.mockClear();
    });
    Object.values(mockVscode.lm).forEach(m => m.mockClear());
    Object.values(mockVscode.commands).forEach(m => m.mockClear());
    mockLanguageModelChat.sendRequest.mockClear();
    mockOutputChannel.appendLine.mockClear();
  });

  describe("testLanguageModel", () => {
    test("should test available language models", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      await testLanguageModel();

      expect(mockVscode.lm.selectChatModels).toHaveBeenCalledWith({
        vendor: "boost",
        family: "boost"
      });

      expect(mockLogger.log).toHaveBeenCalledWith("Found 1 boost language models");
      expect(mockLogger.log).toHaveBeenCalledWith("Testing model: Test Model (test-model-id)");

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Language model tests completed. Check output for details."
      );
    });

    test("should handle no available models", async () => {
      mockVscode.lm.selectChatModels.mockResolvedValueOnce([]);

      const { testLanguageModel } = await import("../../src/test-lm-api");

      await testLanguageModel();

      expect(mockLogger.log).toHaveBeenCalledWith("Found 0 boost language models");
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        "No boost language models available"
      );
    });

    test("should handle errors during model selection", async () => {
      const error = new Error("Model selection failed");
      mockVscode.lm.selectChatModels.mockRejectedValueOnce(error);

      const { testLanguageModel } = await import("../../src/test-lm-api");

      await testLanguageModel();

      expect(mockLogger.error).toHaveBeenCalledWith("Error testing language models:", error);
      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Language model test failed: Error: Model selection failed"
      );
    });

    test("should test individual model successfully", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      // Mock successful response
      mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
        text: (async function* () {
          yield "Hello";
          yield "!";
        })()
      });

      await testLanguageModel();

      expect(mockLanguageModelChat.sendRequest).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: mockVscode.LanguageModelChatMessageRole.User
          })
        ]),
        {},
        expect.any(Object)
      );

      expect(mockLogger.log).toHaveBeenCalledWith("Sending request to Test Model...");
      expect(mockLogger.log).toHaveBeenCalledWith("Response from Test Model: Hello!");
    });

    test("should handle model request errors", async () => {
      const error = new Error("Model request failed");
      mockLanguageModelChat.sendRequest.mockRejectedValueOnce(error);

      const { testLanguageModel } = await import("../../src/test-lm-api");

      await testLanguageModel();

      expect(mockLogger.error).toHaveBeenCalledWith("Error testing model Test Model:", error);
    });

    test("should handle streaming response correctly", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      // Mock streaming response
      mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
        text: (async function* () {
          yield "First";
          yield " chunk";
          yield " of";
          yield " response";
        })()
      });

      await testLanguageModel();

      expect(mockLogger.log).toHaveBeenCalledWith("Response from Test Model: First chunk of response");
    });

    test("should handle empty response", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      // Mock empty response
      mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
        text: (async function* () {
          // Empty generator
        })()
      });

      await testLanguageModel();

      expect(mockLogger.log).toHaveBeenCalledWith("Response from Test Model: ");
    });
  });

  describe("registerTestCommands", () => {
    test("should register all test commands", async () => {
      const mockContext = {
        subscriptions: {
          push: mock(() => {})
        }
      };

      const { registerTestCommands } = await import("../../src/test-lm-api");

      registerTestCommands(mockContext as any);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.test.languageModel",
        expect.any(Function)
      );

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.test.modelSelection",
        expect.any(Function)
      );

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        "copilot-boost-mode.test.all",
        expect.any(Function)
      );

      expect(mockContext.subscriptions.push).toHaveBeenCalledTimes(3);
    });

    test("should execute registered commands", async () => {
      const mockContext = {
        subscriptions: {
          push: mock(() => {})
        }
      };

      const { registerTestCommands } = await import("../../src/test-lm-api");

      registerTestCommands(mockContext as any);

      // Get the command handlers
      const commandCalls = mockVscode.commands.registerCommand.mock.calls;

      const languageModelHandler = commandCalls.find(
        call => call[0] === "copilot-boost-mode.test.languageModel"
      )?.[1];

      expect(languageModelHandler).toBeDefined();

      // Execute the command
      await languageModelHandler();

      expect(mockVscode.lm.selectChatModels).toHaveBeenCalled();
    });
  });

  describe("Model Selection Test", () => {
    test("should test model selection", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      // Set up multiple models
      const models = [
        {
          ...mockLanguageModelChat,
          name: "Model 1",
          id: "model-1",
          sendRequest: mock(() => ({
            text: (async function* () { yield "Response 1"; })()
          }))
        },
        {
          ...mockLanguageModelChat,
          name: "Model 2",
          id: "model-2",
          sendRequest: mock(() => ({
            text: (async function* () { yield "Response 2"; })()
          }))
        }
      ];

      mockVscode.lm.selectChatModels.mockResolvedValueOnce(models);

      await testLanguageModel();

      expect(mockLogger.log).toHaveBeenCalledWith("Found 2 boost language models");
      expect(mockLogger.log).toHaveBeenCalledWith("Testing model: Model 1 (model-1)");
      expect(mockLogger.log).toHaveBeenCalledWith("Testing model: Model 2 (model-2)");
    });
  });

  describe("Error Recovery", () => {
    test("should continue testing other models if one fails", async () => {
      const { testLanguageModel } = await import("../../src/test-lm-api");

      const models = [
        {
          ...mockLanguageModelChat,
          name: "Good Model",
          id: "good-model",
          sendRequest: mock(() => ({
            text: (async function* () { yield "Success"; })()
          }))
        },
        {
          ...mockLanguageModelChat,
          name: "Bad Model",
          id: "bad-model",
          sendRequest: mock(() => Promise.reject(new Error("Model failed")))
        }
      ];

      mockVscode.lm.selectChatModels.mockResolvedValueOnce(models);

      await testLanguageModel();

      expect(mockLogger.log).toHaveBeenCalledWith("Testing model: Good Model (good-model)");
      expect(mockLogger.log).toHaveBeenCalledWith("Testing model: Bad Model (bad-model)");
      expect(mockLogger.error).toHaveBeenCalledWith("Error testing model Bad Model:", expect.any(Error));
      expect(mockLogger.log).toHaveBeenCalledWith("Response from Good Model: Success");
    });
  });
});
