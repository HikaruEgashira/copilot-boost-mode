import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Activation Test Suite", () => {
  test("Extension should be loaded", () => {
    const extension = vscode.extensions.getExtension("HikaruEgashira.copilot-boost-mode");
    assert.ok(extension, "Extension should be loaded");
  });

  test("Extension should activate successfully", async function() {
    this.timeout(10000);

    const extension = vscode.extensions.getExtension("HikaruEgashira.copilot-boost-mode");
    if (!extension) {
      assert.fail("Extension not found");
      return;
    }

    console.log("Extension isActive:", extension.isActive);

    if (!extension.isActive) {
      console.log("Activating extension...");
      try {
        await extension.activate();
        console.log("Extension activated successfully");
      } catch (error) {
        console.error("Extension activation failed:", error);
        throw error;
      }
    }

    assert.ok(extension.isActive, "Extension should be active after activation");

    // Wait a bit more for full initialization
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if commands are registered after activation
    const allCommands = await vscode.commands.getCommands(true);
    const boostCommands = allCommands.filter(cmd => cmd.includes("copilot-boost-mode"));
    console.log("Commands after activation:", boostCommands);

    assert.ok(boostCommands.length > 0, "At least one boost command should be registered after activation");
  });
});
