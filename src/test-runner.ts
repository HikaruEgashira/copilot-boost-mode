import * as vscode from "vscode";
import { logger } from "./logger";

export class TestRunner {
  private results: { test: string; status: "PASS" | "FAIL"; message: string; }[] = [];

  async runAllTests(): Promise<void> {
    this.results = [];
    
    try {
      await this.testModelSelection();
      await this.testBasicChat();
      await this.testTokenCounting();
      await this.testProviderRegistration();
      
      this.printResults();
    } catch (error) {
      logger.error("Test suite failed:", error);
      this.addResult("Test Suite", "FAIL", `Test suite crashed: ${error}`);
      this.printResults();
    }
  }

  private async testModelSelection(): Promise<void> {
    try {
      const allModels = await vscode.lm.selectChatModels();
      this.addResult("Model Selection - All Models", "PASS", `Found ${allModels.length} total models`);

      const boostModels = await vscode.lm.selectChatModels({ vendor: "boost" });
      this.addResult("Model Selection - Boost Models", "PASS", `Found ${boostModels.length} boost models`);

      const familyModels = await vscode.lm.selectChatModels({ family: "boost" });
      this.addResult("Model Selection - Family Filter", "PASS", `Found ${familyModels.length} models in boost family`);

      if (boostModels.length > 0) {
        const modelInfo = boostModels.map(m => `${m.name} (${m.id})`).join(", ");
        this.addResult("Available Models", "PASS", `Models: ${modelInfo}`);
      } else {
        this.addResult("Available Models", "FAIL", "No boost models available - check API keys");
      }

    } catch (error) {
      this.addResult("Model Selection", "FAIL", `Error: ${error}`);
    }
  }

  private async testBasicChat(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "boost" });
      
      if (models.length === 0) {
        this.addResult("Basic Chat", "FAIL", "No models available for testing");
        return;
      }

      const testModel = models[0];
      const messages = [
        new vscode.LanguageModelChatMessage(
          vscode.LanguageModelChatMessageRole.User,
          "Respond with exactly: 'API_TEST_SUCCESS'"
        )
      ];

      const tokenSource = new vscode.CancellationTokenSource();
      
      try {
        const request = await testModel.sendRequest(messages, {}, tokenSource.token);
        
        let response = "";
        for await (const fragment of request.text) {
          response += fragment;
        }

        if (response.length > 0) {
          this.addResult("Basic Chat", "PASS", `Model ${testModel.name} responded: "${response.trim()}"`);
        } else {
          this.addResult("Basic Chat", "FAIL", `Model ${testModel.name} returned empty response`);
        }

      } finally {
        tokenSource.dispose();
      }

    } catch (error) {
      this.addResult("Basic Chat", "FAIL", `Chat request failed: ${error}`);
    }
  }

  private async testTokenCounting(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: "boost" });
      
      if (models.length === 0) {
        this.addResult("Token Counting", "FAIL", "No models available for testing");
        return;
      }

      const testModel = models[0];
      const testText = "This is a test message for token counting.";
      
      const tokenSource = new vscode.CancellationTokenSource();
      
      try {
        const tokenCount = await testModel.countTokens(testText, tokenSource.token);
        
        if (typeof tokenCount === 'number' && tokenCount > 0) {
          this.addResult("Token Counting", "PASS", `Token count for test text: ${tokenCount}`);
        } else {
          this.addResult("Token Counting", "FAIL", `Invalid token count: ${tokenCount}`);
        }

      } finally {
        tokenSource.dispose();
      }

    } catch (error) {
      this.addResult("Token Counting", "FAIL", `Token counting failed: ${error}`);
    }
  }

  private async testProviderRegistration(): Promise<void> {
    try {
      const boostModels = await vscode.lm.selectChatModels({ vendor: "boost" });
      
      const expectedProviders = ["anthropic", "openai", "groq", "gemini", "openrouter"];
      const availableProviders = boostModels.map(m => m.id).filter(id => 
        expectedProviders.some(provider => id.includes(provider))
      );

      if (availableProviders.length > 0) {
        this.addResult("Provider Registration", "PASS", `Registered providers: ${availableProviders.join(", ")}`);
      } else {
        this.addResult("Provider Registration", "FAIL", "No expected providers found");
      }

      for (const model of boostModels) {
        const hasBasicInfo = model.name && model.id && model.vendor && model.family;
        if (hasBasicInfo) {
          this.addResult(`Provider ${model.name}`, "PASS", `Basic info complete`);
        } else {
          this.addResult(`Provider ${model.name}`, "FAIL", `Missing basic info`);
        }
      }

    } catch (error) {
      this.addResult("Provider Registration", "FAIL", `Registration test failed: ${error}`);
    }
  }

  private addResult(test: string, status: "PASS" | "FAIL", message: string): void {
    this.results.push({ test, status, message });
    const icon = status === "PASS" ? "✓" : "✗";
    logger.log(`${icon} ${test}: ${message}`);
  }

  private printResults(): void {
    const passCount = this.results.filter(r => r.status === "PASS").length;
    const failCount = this.results.filter(r => r.status === "FAIL").length;
    const total = this.results.length;

    logger.log(`\n=== TEST RESULTS ===`);
    logger.log(`Total Tests: ${total}`);
    logger.log(`Passed: ${passCount}`);
    logger.log(`Failed: ${failCount}`);
    logger.log(`Success Rate: ${((passCount / total) * 100).toFixed(1)}%`);

    if (failCount === 0) {
      logger.log(`\n🎉 ALL TESTS PASSED!`);
      vscode.window.showInformationMessage(`✅ All ${total} tests passed!`);
    } else {
      logger.log(`\n❌ ${failCount} test(s) failed.`);
      vscode.window.showWarningMessage(`⚠️ ${failCount}/${total} tests failed. Check output for details.`);
    }

    logger.log(`\n=== DETAILED RESULTS ===`);
    for (const result of this.results) {
      const icon = result.status === "PASS" ? "✓" : "✗";
      logger.log(`${icon} ${result.test}: ${result.message}`);
    }
  }
}

export function registerTestRunner(context: vscode.ExtensionContext) {
  const testRunner = new TestRunner();
  
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.test.comprehensive", () => {
      testRunner.runAllTests();
    })
  );
}