import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = path.resolve(import.meta.dir, "../..");
const ARM_RUNNER = "self-hosted, linux, arm64, hikae-flash";

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("CI configuration", () => {
  test("default test workflow runs on the hikae ARM64 runner", () => {
    const workflow = read(".github/workflows/test.yml");
    expect(workflow).toContain(`runs-on: [${ARM_RUNNER}]`);
    expect(workflow).not.toContain("runs-on: ubuntu-latest");
  });

  test("VS Code test workflow uses the hikae ARM64 runner", () => {
    const workflow = read(".github/workflows/vscode-test.yml");
    expect(workflow).toContain("os: [hikae-flash]");
    expect(workflow).toContain(`runner: [${ARM_RUNNER}]`);
    expect(workflow).not.toContain("os: [ubuntu-latest");
  });

  test("test:vscode compiles the e2e tests before running them", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["test:vscode"]).toContain("compile:tests");
    expect(pkg.scripts["test:vscode"]).toContain("out/tests/e2e/runTest.js");
    expect(pkg.scripts["compile:tests"]).toContain("tsconfig.test.json");
  });
});
