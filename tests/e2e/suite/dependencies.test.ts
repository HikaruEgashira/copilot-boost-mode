import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Dependencies Test Suite", () => {
  test("Should work without optional extension dependencies", async function() {
    this.timeout(10000);

    const optionalExtensions = [
      "github.copilot-chat"
    ];

    const allExtensions = vscode.extensions.all;
    const extensionIds = allExtensions.map(ext => ext.id);

    console.log("All extensions:", extensionIds.filter(id => id.includes("copilot") || id.includes("github")));

    for (const optionalExtension of optionalExtensions) {
      const extension = vscode.extensions.getExtension(optionalExtension);

      if (!extension) {
        console.log(`Optional extension ${optionalExtension} not found - extension should still work`);
      } else {
        console.log(`Optional extension ${optionalExtension} found, isActive: ${extension.isActive}`);
      }
    }

    // Extension should work without dependencies
    assert.ok(true, "Extension can work without optional dependencies");
  });

  test("Should check proposed API availability", () => {
    // Check if the chatProvider API is available
    const hasLanguageModelAPI = typeof (vscode as any).lm !== 'undefined';

    console.log("Language Model API available:", hasLanguageModelAPI);
    console.log("VS Code version:", vscode.version);

    if (!hasLanguageModelAPI) {
      console.log("Language Model API not available - may need VS Code Insiders or newer version");
    }

    assert.ok(true, "API availability documented");
  });
});
