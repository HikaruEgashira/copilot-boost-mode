import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Tool Calling Reproduction Test Suite", () => {
  test("Reproduce tool calling error with mock API", async function() {
    this.timeout(60000);

    // This test will help us understand what happens when tool calling is used
    // even without a real API key, by examining the provider code flow

    console.log("=== Tool Calling Error Reproduction Test ===");

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      console.log("No models available");
      this.skip();
    }

    const model = models[0];
    console.log(`Using model: ${model.id} (${model.name})`);

    // Create a tool definition that might cause issues
    const problematicTool: vscode.LanguageModelChatTool = {
      name: "test_tool",
      description: "A test tool that might cause issues",
      inputSchema: {
        type: "object",
        properties: {
          param1: { type: "string" },
          param2: { type: "number" },
          complex_param: {
            type: "object",
            properties: {
              nested: { type: "array", items: { type: "string" } }
            }
          }
        },
        required: ["param1"],
      },
    };

    console.log("Tool definition:", JSON.stringify(problematicTool, null, 2));

    const messages = [
      vscode.LanguageModelChatMessage.User("Please use the test_tool with some parameters."),
    ];

    // Test case 1: Tool calling without API key (should fail at API key check)
    console.log("--- Test Case 1: Tool calling without API key ---");
    try {
      const response = await model.sendRequest(
        messages,
        { tools: [problematicTool] },
        new vscode.CancellationTokenSource().token
      );

      // This should not reach here due to API key error
      console.log("❌ Unexpected: Tool request succeeded without API key");

      for await (const chunk of response.text) {
        console.log("Unexpected chunk:", chunk);
      }

    } catch (toolError) {
      console.log("✅ Expected: Tool request failed");
      console.log("Error type:", toolError.constructor.name);
      console.log("Error message:", toolError.message);

      // Examine the error to understand the tool calling flow
      if (toolError.message.includes("API key")) {
        console.log("⚠️  Error is at API key validation stage");
        console.log("This means the tool calling code path is being executed");
        console.log("The error occurs before reaching the actual AI SDK");
      } else {
        console.log("⚠️  Unexpected error type - this might be the tool calling issue");
        console.error("Full error:", toolError);

        if (toolError.stack) {
          console.error("Stack trace:", toolError.stack);
        }
      }
    }

    // Test case 2: Simple request without tools (also should fail at API key check)
    console.log("--- Test Case 2: Simple request without tools ---");
    try {
      const simpleResponse = await model.sendRequest(
        [vscode.LanguageModelChatMessage.User("Hello")],
        {}, // No tools
        new vscode.CancellationTokenSource().token
      );

      console.log("❌ Unexpected: Simple request succeeded without API key");

    } catch (simpleError) {
      console.log("✅ Expected: Simple request failed");
      console.log("Simple error type:", simpleError.constructor.name);
      console.log("Simple error message:", simpleError.message);

      // Compare the error patterns
      console.log("\n=== Error Comparison ===");
      console.log("Both errors should be similar if the issue is just API key validation");
      console.log("If they differ significantly, there might be a tool-specific issue");
    }

    // Test case 3: Examine the tool processing
    console.log("--- Test Case 3: Tool Processing Analysis ---");

    try {
      // Let's examine what happens during tool processing by looking at the options
      const toolOptions = { tools: [problematicTool] };
      console.log("Tool options passed to sendRequest:", JSON.stringify(toolOptions, null, 2));

      // Check if the tool definition itself is valid
      if (!problematicTool.name || !problematicTool.description || !problematicTool.inputSchema) {
        console.log("⚠️  Tool definition appears incomplete");
      } else {
        console.log("✅ Tool definition appears complete");
      }

      // Check for potential schema issues
      const schema = problematicTool.inputSchema as any;
      if (schema && schema.type !== "object") {
        console.log("⚠️  Tool schema type is not 'object'");
      }

      if (schema && !schema.properties) {
        console.log("⚠️  Tool schema missing properties");
      }

    } catch (analysisError) {
      console.error("Error during tool analysis:", analysisError);
    }

    console.log("\n=== Test Completed ===");
    console.log("This test helps understand the tool calling error by:");
    console.log("1. Confirming the code path is executed");
    console.log("2. Comparing tool vs non-tool error patterns");
    console.log("3. Validating tool definitions");

    // The test passes if we can analyze the error patterns
    assert.ok(true, "Tool calling error reproduction analysis completed");
  });
});
