import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Tool Calling Error Reproduction Test Suite", () => {
  test("Reproduce actual tool calling error with bypassed API key", async function() {
    this.timeout(90000); // 1.5 minutes for debugging

    console.log("=== Tool Calling Error Reproduction with API Key Bypass ===");
    console.log("Environment VSCODE_EXTENSION_UNDER_TEST:", process.env.VSCODE_EXTENSION_UNDER_TEST);
    console.log("Environment ANTHROPIC_API_KEY available:", !!process.env.ANTHROPIC_API_KEY);

    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      console.log("❌ No Anthropic models available");
      this.skip();
    }

    const model = models[0];
    console.log(`✅ Using model: ${model.id} (${model.name})`);

    // First test: Simple request to verify the API key bypass works
    console.log("\n--- Phase 1: Simple Request Test ---");
    const simpleMessages = [
      vscode.LanguageModelChatMessage.User("Say exactly: 'API key bypass working'"),
    ];

    try {
      console.log("Sending simple request...");
      const simpleResponse = await model.sendRequest(
        simpleMessages,
        {}, // No tools
        new vscode.CancellationTokenSource().token
      );

      let simpleText = "";
      for await (const chunk of simpleResponse.text) {
        simpleText += chunk;
        console.log(`Simple chunk: "${chunk}"`);
      }

      console.log("✅ Simple request response:", simpleText);

      if (simpleText.length === 0) {
        throw new Error("Empty response from simple request");
      }

    } catch (simpleError) {
      console.error("❌ Simple request failed:");
      console.error("Error type:", simpleError.constructor.name);
      console.error("Error message:", simpleError.message);

      if (simpleError.message.includes("API key")) {
        console.log("💡 Still failing at API key - the bypass didn't work");
        throw simpleError;
      } else {
        console.log("🔍 Different error - this might be the actual tool calling issue!");
        console.error("Full error object:", simpleError);
        if (simpleError.stack) {
          console.error("Stack trace:", simpleError.stack);
        }
        throw simpleError;
      }
    }

    // Second test: Tool calling request to see the actual error
    console.log("\n--- Phase 2: Tool Calling Test ---");

    const testTool: vscode.LanguageModelChatTool = {
      name: "test_function",
      description: "A test function to demonstrate tool calling",
      inputSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "A message to process"
          },
          count: {
            type: "number",
            description: "A number to use in processing"
          }
        },
        required: ["message"],
      },
    };

    console.log("Tool definition:", JSON.stringify(testTool, null, 2));

    const toolMessages = [
      vscode.LanguageModelChatMessage.User("Please use the test_function tool with message='hello' and count=5."),
    ];

    try {
      console.log("Sending tool calling request...");

      const toolResponse = await model.sendRequest(
        toolMessages,
        { tools: [testTool] },
        new vscode.CancellationTokenSource().token
      );

      console.log("✅ Tool response received, processing stream...");

      let toolText = "";
      let chunkCount = 0;
      let toolCallDetected = false;

      for await (const chunk of toolResponse.text) {
        chunkCount++;
        toolText += chunk;
        console.log(`Tool chunk ${chunkCount}: "${chunk}"`);

        if (chunk.includes("test_function") || chunk.includes("tool") || chunk.includes("function")) {
          toolCallDetected = true;
          console.log("🔧 Tool call detected!");
        }
      }

      console.log(`\n=== Tool Calling Results ===`);
      console.log(`Total chunks: ${chunkCount}`);
      console.log(`Response length: ${toolText.length}`);
      console.log(`Tool call detected: ${toolCallDetected}`);
      console.log(`Full response:\n${toolText}`);

      if (toolText.length === 0) {
        throw new Error("Empty response from tool calling request");
      }

      console.log("✅ Tool calling test completed successfully!");

      // The test passes if we get any response
      assert.ok(toolText.length > 0, "Tool response should not be empty");

    } catch (toolError) {
      console.error("\n❌ Tool calling failed - THIS IS THE ERROR WE WANT TO ANALYZE:");
      console.error("Error type:", toolError.constructor.name);
      console.error("Error message:", toolError.message);
      console.error("Error code:", (toolError as any).code);

      if (toolError.stack) {
        console.error("Stack trace:", toolError.stack);
      }

      // Check for specific error patterns
      if (toolError.message.includes("API key")) {
        console.log("💡 Still an API key issue - bypass not working properly");
      } else if (toolError.message.includes("tool")) {
        console.log("🎯 This appears to be a tool-specific error!");
      } else if (toolError.message.includes("schema")) {
        console.log("🎯 This might be a tool schema validation error!");
      } else if (toolError.message.includes("streaming")) {
        console.log("🎯 This might be a streaming-related tool calling error!");
      } else {
        console.log("🔍 Unknown error pattern - needs investigation");
      }

      // Log additional error properties
      console.log("\n=== Error Analysis ===");
      const errorProps = Object.getOwnPropertyNames(toolError);
      for (const prop of errorProps) {
        try {
          const value = (toolError as any)[prop];
          if (typeof value !== 'function') {
            console.log(`${prop}:`, value);
          }
        } catch (e) {
          console.log(`${prop}: [cannot access]`);
        }
      }

      // Re-throw to fail the test and show the exact error
      throw toolError;
    }
  });
});
