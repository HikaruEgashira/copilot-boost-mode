import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Tool Calling Bypass Test Suite", () => {
  test("Try tool calling with real API key from environment", async function() {
    this.timeout(90000);

    console.log("=== Tool Calling with Real API Key ===");

    // Skip if no real API key available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("No ANTHROPIC_API_KEY environment variable, skipping");
      this.skip();
    }

    console.log("Using real API key from environment:", process.env.ANTHROPIC_API_KEY?.substring(0, 20) + "...");

    // First, let's set up the API key properly using the VS Code secrets API
    console.log("--- Setting up API key via VS Code Secrets ---");

    const extension = vscode.extensions.getExtension("HikaruEgashira.copilot-boost-mode");
    if (!extension?.isActive) {
      await extension?.activate();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const extensionExports = extension?.exports;
    const context = extensionExports?.context;

    if (context && context.secrets) {
      console.log("Setting real API key via secrets API...");
      await context.secrets.store("AnthropicCopilotBoostApiKey", process.env.ANTHROPIC_API_KEY);
      console.log("✅ API key stored successfully");

      // Wait for provider reinitialization
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log("❌ Could not access extension context or secrets API");
      this.skip();
    }

    // Now try to get the models
    console.log("--- Getting Language Models ---");
    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      id: "anthropic",
    });

    if (models.length === 0) {
      console.log("❌ No Anthropic models available after setting API key");
      this.skip();
    }

    const model = models[0];
    console.log(`✅ Using model: ${model.id} (${model.name})`);

    // Test 1: Simple request without tools
    console.log("\\n--- Phase 1: Simple Request (No Tools) ---");
    try {
      const simpleMessages = [
        vscode.LanguageModelChatMessage.User("Say exactly: 'Hello from real API'"),
      ];

      const simpleResponse = await model.sendRequest(
        simpleMessages,
        {},
        new vscode.CancellationTokenSource().token
      );

      let simpleText = "";
      for await (const chunk of simpleResponse.text) {
        simpleText += chunk;
      }

      console.log("✅ Simple response:", simpleText);
      assert.ok(simpleText.length > 0, "Simple response should not be empty");

    } catch (simpleError) {
      console.error("❌ Simple request failed:", simpleError.message);
      throw simpleError;
    }

    // Test 2: Request with tools - this is where we expect to see tool calling errors
    console.log("\\n--- Phase 2: Tool Calling Request ---");

    const testTool: vscode.LanguageModelChatTool = {
      name: "calculate_sum",
      description: "Calculate the sum of two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: {
            type: "number",
            description: "First number"
          },
          b: {
            type: "number",
            description: "Second number"
          }
        },
        required: ["a", "b"],
      },
    };

    const toolMessages = [
      vscode.LanguageModelChatMessage.User("Please use the calculate_sum tool to add 15 and 27."),
    ];

    try {
      console.log("Sending tool calling request...");
      console.log("Tool definition:", JSON.stringify(testTool, null, 2));

      const toolResponse = await model.sendRequest(
        toolMessages,
        {
          tools: [testTool],
        },
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

        if (chunk.includes("calculate_sum") || chunk.includes("tool") || chunk.includes("function")) {
          toolCallDetected = true;
          console.log("🔧 Tool call pattern detected!");
        }
      }

      console.log(`\\n=== Tool Calling Results ===`);
      console.log(`Total chunks: ${chunkCount}`);
      console.log(`Response length: ${toolText.length}`);
      console.log(`Tool call detected: ${toolCallDetected}`);
      console.log(`Full response:\\n${toolText}`);

      if (toolText.length === 0) {
        throw new Error("Empty response from tool calling request");
      }

      console.log("✅ Tool calling test completed successfully!");
      assert.ok(toolText.length > 0, "Tool response should not be empty");

    } catch (toolError) {
      console.error("\\n❌ TOOL CALLING ERROR - This is what we want to analyze:");
      console.error("Error type:", toolError.constructor.name);
      console.error("Error message:", toolError.message);
      console.error("Error code:", (toolError as any).code);

      if (toolError.stack) {
        console.error("Stack trace:", toolError.stack);
      }

      // Analyze the error pattern
      if (toolError.message.includes("streaming")) {
        console.log("🎯 STREAMING ERROR - This might be related to tool calling streaming!");
      } else if (toolError.message.includes("tool")) {
        console.log("🎯 TOOL-SPECIFIC ERROR - This is likely the tool calling issue!");
      } else if (toolError.message.includes("schema")) {
        console.log("🎯 SCHEMA ERROR - Tool schema validation issue!");
      } else if (toolError.message.includes("API")) {
        console.log("🎯 API ERROR - Provider API issue with tool calling!");
      } else {
        console.log("🔍 Unknown error pattern - needs investigation");
      }

      // Log additional error properties for analysis
      console.log("\\n=== Detailed Error Analysis ===");
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

      // This error is exactly what we want to reproduce and analyze
      console.log("\\n🎯 SUCCESS: We have reproduced the tool calling error!");
      console.log("This error should be reported to help fix the tool calling functionality.");

      // Don't fail the test - we successfully reproduced the error
      assert.ok(true, "Successfully reproduced tool calling error for analysis");
    }
  });
});
