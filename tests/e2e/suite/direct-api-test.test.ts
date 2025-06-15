import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Direct API Test Suite", () => {
  test("Test tool calling with direct VS Code command", async function() {
    this.timeout(60000);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("ANTHROPIC_API_KEY not set, skipping test");
      this.skip();
    }

    // Use the VS Code command to set the API key directly
    try {
      // Wait for extension to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to set the API key using the vscode command (this might trigger input dialog)
      console.log("Attempting to use command to set API key...");

      // For the test, we'll directly call the provider and simulate the error/success
      console.log("Checking if models are available...");

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

      // Try a simple request first
      const simpleMessages = [
        vscode.LanguageModelChatMessage.User("Say 'test' only."),
      ];

      try {
        console.log("Testing simple request...");
        const response = await model.sendRequest(simpleMessages, {}, new vscode.CancellationTokenSource().token);

        let responseText = "";
        for await (const chunk of response.text) {
          responseText += chunk;
        }

        console.log("Simple response:", responseText);
        console.log("✅ Simple request succeeded");

      } catch (simpleError) {
        console.log("❌ Simple request failed:", simpleError.message);

        // If simple request fails, we know it's an API key issue
        if (simpleError.message.includes("API key")) {
          console.log("API key error confirmed for simple request");
          this.skip();
        }
        throw simpleError;
      }

      // Now test with tools
      const weatherTool: vscode.LanguageModelChatTool = {
        name: "get_weather",
        description: "Get weather for a location",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" }
          },
          required: ["location"],
        },
      };

      const toolMessages = [
        vscode.LanguageModelChatMessage.User("What's the weather in Tokyo? Use the get_weather tool."),
      ];

      console.log("Testing tool calling...");
      console.log("Tool definition:", JSON.stringify(weatherTool, null, 2));

      try {
        const toolResponse = await model.sendRequest(
          toolMessages,
          { tools: [weatherTool] },
          new vscode.CancellationTokenSource().token
        );

        console.log("Tool response received, processing stream...");

        let toolResponseText = "";
        let chunkCount = 0;

        for await (const chunk of toolResponse.text) {
          chunkCount++;
          toolResponseText += chunk;
          console.log(`Tool chunk ${chunkCount}: "${chunk}"`);
        }

        console.log("Tool response text:", toolResponseText);
        console.log("Tool chunks count:", chunkCount);
        console.log("✅ Tool calling test completed successfully");

        assert.ok(toolResponseText.length > 0, "Tool response should not be empty");

      } catch (toolError) {
        console.error("❌ Tool calling error:");
        console.error("Tool error type:", toolError.constructor.name);
        console.error("Tool error message:", toolError.message);
        console.error("Tool error stack:", toolError.stack);

        // This is where we'd see the specific tool calling error
        throw toolError;
      }

    } catch (error) {
      console.error("Overall test error:", error);
      throw error;
    }
  });
});
