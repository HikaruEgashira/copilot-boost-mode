import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Extension should be present", () => {
    assert.ok(vscode.extensions.getExtension("HikaruEgashira.copilot-boost-mode"));
  });

  test("VS Code API should be available", () => {
    assert.ok(vscode.window);
    assert.ok(vscode.commands);
    assert.ok(vscode.extensions);
  });

  test("Can get all commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
  });
});
