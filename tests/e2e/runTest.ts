import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../..");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    const version = process.env.VSCODE_VERSION || "insiders";

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version,
      launchArgs: [
        "--disable-gpu",
      ],
      // Install required extensions
      extensionTestsEnv: {
        VSCODE_EXTENSION_UNDER_TEST: 'true'
      }
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

main();
