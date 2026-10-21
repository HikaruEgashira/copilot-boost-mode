import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Language Model Provider API", () => {
  test("public provider registration is available", () => {
    assert.strictEqual(typeof vscode.lm.registerLanguageModelChatProvider, "function");
  });
});
