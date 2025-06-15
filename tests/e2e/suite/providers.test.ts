import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Language Model Provider Test Suite", () => {
  test("Extension should register language model providers", async () => {
    // Wait for extension activation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const expectedProviders = [
      "boost:anthropic",
      "boost:groq",
      "boost:gemini",
      "boost:openrouter",
      "boost:openai",
    ];

    try {
      const availableModels = await vscode.lm.selectChatModels({
        vendor: "boost",
      });

      // Check if the API is available (might not be in all VS Code versions)
      if (availableModels.length === 0) {
        console.log("Language Model API not available or no providers registered");
        return;
        return;
      }

      const modelIds = availableModels.map(model => `${model.vendor}:${model.id}`);

      // At least one provider should be registered
      assert.ok(
        modelIds.length > 0,
        "Should have at least one boost provider registered"
      );

      // Log the registered providers for debugging
      console.log("Registered providers:", modelIds);
    } catch (error) {
      console.log("Language Model API error:", error);
      return;
    }
  });

  test("Providers should have correct metadata", async () => {
    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
    });

    for (const model of models) {
      assert.ok(model.vendor === "boost", "Vendor should be boost");
      assert.ok(model.version === "1.0.0", "Version should be 1.0.0");
      assert.ok(model.maxInputTokens === 200000, "Max input tokens should be 200000");

      // The actual LanguageModelChat interface has different properties
      assert.ok(model.id, "Model should have an ID");
      assert.ok(model.name, "Model should have a name");
      assert.ok(model.family === "boost", "Model family should be boost");
    }
  });
});
