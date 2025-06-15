import { describe, test, expect } from "bun:test";
import packageJson from "../../package.json";

describe("Configuration", () => {
  test("should have valid package.json", () => {
    expect(packageJson.name).toBe("copilot-boost-mode");
    expect(packageJson.publisher).toBe("HikaruEgashira");
    expect(typeof packageJson.version).toBe("string");
    expect(packageJson.version.length).toBeGreaterThan(0);
  });

  test("should have required VS Code engine", () => {
    expect(packageJson.engines).toBeDefined();
    expect(packageJson.engines.vscode).toBeDefined();
    expect(packageJson.engines.vscode).toMatch(/^\^1\.\d+\.\d+$/);
  });

  test("should have required extension dependencies", () => {
    expect(packageJson.extensionDependencies).toBeDefined();
    expect(packageJson.extensionDependencies).toContain("github.copilot-chat");
  });

  test("should have language model configuration", () => {
    expect(packageJson.contributes).toBeDefined();
    expect(packageJson.contributes.languageModels).toBeDefined();
    expect(packageJson.contributes.languageModels.vendor).toBe("boost");
  });

  test("should have all required commands", () => {
    const commands = packageJson.contributes.commands;
    expect(commands).toBeDefined();

    const commandIds = commands.map((cmd: any) => cmd.command);

    // API key commands
    expect(commandIds).toContain("copilot-boost-mode.anthropic.setKey");
    expect(commandIds).toContain("copilot-boost-mode.openai.setKey");
    expect(commandIds).toContain("copilot-boost-mode.groq.setKey");
    expect(commandIds).toContain("copilot-boost-mode.gemini.setKey");

    // Test commands
    expect(commandIds).toContain("copilot-boost-mode.test.languageModel");
    expect(commandIds).toContain("copilot-boost-mode.test.comprehensive");
  });

  test("should have provider configurations", () => {
    const config = packageJson.contributes.configuration;
    expect(config).toBeDefined();

    // Check each provider config
    expect(config["copilot-boost-mode.anthropic"]).toBeDefined();
    expect(config["copilot-boost-mode.openai"]).toBeDefined();
    expect(config["copilot-boost-mode.groq"]).toBeDefined();
    expect(config["copilot-boost-mode.gemini"]).toBeDefined();
    expect(config["copilot-boost-mode.openrouter"]).toBeDefined();
  });

  test("should have required dependencies", () => {
    const deps = packageJson.dependencies;
    expect(deps).toBeDefined();

    // AI SDK dependencies
    expect(deps["@ai-sdk/anthropic"]).toBeDefined();
    expect(deps["@ai-sdk/openai"]).toBeDefined();
    expect(deps["@ai-sdk/groq"]).toBeDefined();
    expect(deps["@ai-sdk/google"]).toBeDefined();
    expect(deps["ai"]).toBeDefined();
  });

  test("should have required dev dependencies", () => {
    const devDeps = packageJson.devDependencies;
    expect(devDeps).toBeDefined();

    expect(devDeps["@types/vscode"]).toBeDefined();
    expect(devDeps["typescript"]).toBeDefined();
    expect(devDeps["@biomejs/biome"]).toBeDefined();
  });

  test("should have test scripts", () => {
    const scripts = packageJson.scripts;
    expect(scripts).toBeDefined();

    expect(scripts.test).toBe("bun test");
    expect(scripts["test:unit"]).toBe("bun test tests/unit");
    expect(scripts["test:integration"]).toBe("bun test tests/integration");
    expect(scripts["test:coverage"]).toBe("bun test --coverage");
  });
});
