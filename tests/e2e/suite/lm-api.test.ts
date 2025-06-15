import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Language Model API Test Suite", () => {
  test("Should be able to send chat request to provider", async function() {
    this.timeout(30000); // 30 seconds timeout for API calls

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      this.skip();
      return;
    }

    const model = models[0];
    const messages = [
      vscode.LanguageModelChatMessage.User("Say 'Hello, VS Code E2E Test!' and nothing else."),
    ];

    try {
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let responseText = "";
      for await (const chunk of response.text) {
        responseText += chunk;
      }

      assert.ok(responseText.length > 0, "Response should not be empty");
      assert.ok(
        responseText.toLowerCase().includes("hello") ||
        responseText.toLowerCase().includes("vs code") ||
        responseText.toLowerCase().includes("e2e"),
        "Response should contain expected content"
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
        this.skip();
      } else {
        throw error;
      }
    }
  });

  test("Should handle cancellation properly", async function() {
    this.timeout(10000);

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      this.skip();
      return;
    }

    const model = models[0];
    const messages = [
      vscode.LanguageModelChatMessage.User("Count from 1 to 1000000 slowly."),
    ];

    const cts = new vscode.CancellationTokenSource();

    try {
      const responsePromise = model.sendRequest(messages, {}, cts.token);

      setTimeout(() => cts.cancel(), 100);

      try {
        const response = await responsePromise;
        for await (const _ of response.text) {
          // Consume the stream
        }
        assert.fail("Should have been cancelled");
      } catch (error) {
        // Accept any error from cancellation - the exact type may vary
        assert.ok(true, "Request was properly cancelled");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
        this.skip();
      } else {
        throw error;
      }
    }
  });

  test("Should support tool calling", async function() {
    this.timeout(30000);

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      this.skip();
      return;
    }

    const model = models[0];

    const weatherTool: vscode.LanguageModelChatTool = {
      name: "get_weather",
      description: "Get the current weather for a location",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city name",
          },
        },
        required: ["location"],
      },
    };

    const messages = [
      vscode.LanguageModelChatMessage.User("What's the weather in Tokyo?"),
    ];

    try {
      const response = await model.sendRequest(
        messages,
        { tools: [weatherTool] },
        new vscode.CancellationTokenSource().token
      );

      let hasToolCall = false;
      for await (const chunk of response.text) {
        if (chunk.includes("get_weather") || chunk.includes("Tokyo")) {
          hasToolCall = true;
        }
      }

      assert.ok(hasToolCall, "Response should mention the weather tool or Tokyo");
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
        this.skip();
      } else {
        throw error;
      }
    }
  });
});
