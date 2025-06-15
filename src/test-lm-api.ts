import * as vscode from "vscode";
import { logger } from "./logger";

export async function testLanguageModel() {
  try {
    // Get all available language models
    const models = await vscode.lm.selectChatModels({
      vendor: "boost",
      family: "boost",
    });

    logger.log(`Found ${models.length} boost language models`);

    if (models.length === 0) {
      vscode.window.showWarningMessage("No boost language models available");
      return;
    }

    // Test each available model
    for (const model of models) {
      logger.log(`Testing model: ${model.name} (${model.id})`);
      await testModel(model);
    }

    vscode.window.showInformationMessage("Language model tests completed. Check output for details.");
  } catch (error) {
    logger.error("Error testing language models:", error);
    vscode.window.showErrorMessage(`Language model test failed: ${error}`);
  }
}

async function testModel(model: vscode.LanguageModelChat) {
  try {
    const messages = [
      new vscode.LanguageModelChatMessage(
        vscode.LanguageModelChatMessageRole.User,
        "Hello! Can you respond with a simple greeting?"
      ),
    ];

    const tokenSource = new vscode.CancellationTokenSource();
    const token = tokenSource.token;

    logger.log(`Sending request to ${model.name}...`);

    const request = await model.sendRequest(messages, {}, token);

    let response = "";
    for await (const fragment of request.text) {
      response += fragment;
    }

    logger.log(`Response from ${model.name}: ${response.trim()}`);

    if (model.id.includes("anthropic") || model.id.includes("openai") || model.id.includes("groq")) {
      await testModelWithTools(model);
    }

    tokenSource.dispose();
  } catch (error) {
    logger.error(`Error testing model ${model.name}:`, error);
  }
}

async function testModelWithTools(model: vscode.LanguageModelChat) {
  try {
    logger.log(`Testing ${model.name} with tools...`);

    const testTool: vscode.LanguageModelChatTool = {
      name: "get_current_time",
      description: "Get the current time",
      inputSchema: {},
    };

    const messages = [
      new vscode.LanguageModelChatMessage(
        vscode.LanguageModelChatMessageRole.User,
        "What time is it now? Use the get_current_time tool."
      ),
    ];

    const tokenSource = new vscode.CancellationTokenSource();
    const token = tokenSource.token;

    const request = await model.sendRequest(
      messages,
      {
        tools: [testTool],
        toolMode: vscode.LanguageModelChatToolMode.Auto,
      },
      token
    );

    let response = "";
    const toolCalls: vscode.LanguageModelToolCallPart[] = [];

    for await (const fragment of request.stream) {
      if (fragment instanceof vscode.LanguageModelTextPart) {
        response += fragment.value;
      } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push(fragment);
        logger.log(`Tool call: ${fragment.name} with args: ${JSON.stringify(fragment.input)}`);
      }
    }

    logger.log(`Tool test response from ${model.name}: ${response.trim()}`);
    logger.log(`Tool calls made: ${toolCalls.length}`);

    tokenSource.dispose();
  } catch (error) {
    logger.error(`Error testing ${model.name} with tools:`, error);
  }
}

export async function testModelSelection() {
  try {
    logger.log("Testing model selection...");

    const allModels = await vscode.lm.selectChatModels();
    logger.log(`Total available models: ${allModels.length}`);

    const boostModels = await vscode.lm.selectChatModels({
      vendor: "boost",
    });
    logger.log(`Boost models available: ${boostModels.length}`);

    const familyModels = await vscode.lm.selectChatModels({
      family: "boost",
    });
    logger.log(`Models in boost family: ${familyModels.length}`);

    for (const model of boostModels) {
      logger.log(`Model: ${model.name} (${model.id})`);
      logger.log(`  Vendor: ${model.vendor}`);
      logger.log(`  Family: ${model.family}`);
      logger.log(`  Version: ${model.version}`);
      logger.log(`  Max Input Tokens: ${model.maxInputTokens}`);
    }
  } catch (error) {
    logger.error("Error in model selection test:", error);
  }
}

export function registerTestCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.test.languageModel", testLanguageModel)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.test.modelSelection", testModelSelection)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-boost-mode.test.all", async () => {
      await testModelSelection();
      await testLanguageModel();
    })
  );
}
