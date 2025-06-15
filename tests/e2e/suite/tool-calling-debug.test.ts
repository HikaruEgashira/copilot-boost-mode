import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Tool Calling Debug Test Suite", () => {
  async function setupAPIKeys() {
    const extension = vscode.extensions.getExtension("HikaruEgashira.copilot-boost-mode");
    if (!extension) {
      console.log("Extension not found");
      return false;
    }

    console.log("Extension found, isActive:", extension.isActive);

    if (!extension.isActive) {
      console.log("Activating extension...");
      await extension.activate();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for activation
    }

    const extensionExports = extension.exports;
    console.log("Extension exports:", extensionExports);

    const context = extensionExports?.context;
    if (!context) {
      console.log("Could not get extension context from exports");
      return false;
    }

    console.log("Extension context obtained successfully");

    if (process.env.ANTHROPIC_API_KEY) {
      await context.secrets.store("AnthropicCopilotBoostApiKey", process.env.ANTHROPIC_API_KEY);
      console.log(`Set API key for Anthropic: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`);
    }

    return true;
  }

  test("Debug tool calling with verbose logging", async function() {
    this.timeout(60000); // 1 minute timeout

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("ANTHROPIC_API_KEY not set, skipping test");
      this.skip();
    }

    const setupSuccess = await setupAPIKeys();
    if (!setupSuccess) {
      console.log("Failed to setup API keys, skipping test");
      this.skip();
    }

    // Force reload the extension to pick up the new API key
    console.log("Waiting for provider reinitialization...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for reinitialization

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      console.log("No Anthropic models available");
      this.skip();
    }

    const model = models[0];
    console.log("Using model:", model.id, model.name);

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
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit"
          }
        },
        required: ["location"],
      },
    };

    console.log("Tool definition:", JSON.stringify(weatherTool, null, 2));

    const messages = [
      vscode.LanguageModelChatMessage.User("What's the weather in Tokyo? Please use the get_weather tool to check."),
    ];

    console.log("Sending request with tools...");

    try {
      const response = await model.sendRequest(
        messages,
        { tools: [weatherTool] },
        new vscode.CancellationTokenSource().token
      );

      console.log("Response received, processing stream...");

      let responseText = "";
      let chunkCount = 0;

      for await (const chunk of response.text) {
        chunkCount++;
        responseText += chunk;
        console.log(`Chunk ${chunkCount}: "${chunk}"`);
      }

      console.log("Full response text:", responseText);
      console.log("Total chunks received:", chunkCount);
      console.log("Response length:", responseText.length);

      // Check if the response contains tool usage indicators
      const hasGetWeather = responseText.includes("get_weather");
      const hasTokyo = responseText.includes("Tokyo");
      const hasToolCall = responseText.includes("tool") || responseText.includes("function");

      console.log("Analysis:");
      console.log("- Contains 'get_weather':", hasGetWeather);
      console.log("- Contains 'Tokyo':", hasTokyo);
      console.log("- Contains tool/function keywords:", hasToolCall);

      assert.ok(responseText.length > 0, "Response should not be empty");
      console.log("✅ Test completed successfully");

    } catch (error) {
      console.error("❌ Tool calling error occurred:");
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      if (error.code) {
        console.error("Error code:", error.code);
      }

      // Re-throw to fail the test so we can see the exact error
      throw error;
    }
  });

  test("Test simple request without tools first", async function() {
    this.timeout(30000);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("ANTHROPIC_API_KEY not set, skipping test");
      this.skip();
    }

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      this.skip();
    }

    const model = models[0];
    const messages = [
      vscode.LanguageModelChatMessage.User("Say hello in exactly 5 words."),
    ];

    try {
      console.log("Testing simple request without tools...");
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let responseText = "";
      for await (const chunk of response.text) {
        responseText += chunk;
      }

      console.log("Simple response:", responseText);
      assert.ok(responseText.length > 0, "Simple response should work");
      console.log("✅ Simple request successful");
    } catch (error) {
      console.error("❌ Even simple request failed:", error);
      throw error;
    }
  });
});
