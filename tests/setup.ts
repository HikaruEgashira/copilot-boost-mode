// Global test setup
import { beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";
import { mockVscode } from "./mocks/vscode-mock";

// Enhanced VSCode mock with additional functionality
const enhancedMockVscode = {
  ...mockVscode,
  window: {
    createOutputChannel: mock(() => ({
      appendLine: mock(),
      show: mock(),
      hide: mock(),
      dispose: mock(),
      name: "Test Channel",
      append: mock(),
      clear: mock(),
      replace: mock(),
    })),
    showErrorMessage: mock(),
    showInformationMessage: mock(),
    showWarningMessage: mock(),
  },
  commands: {
    registerCommand: mock(),
    executeCommand: mock(),
  },
  lm: {
    registerChatProvider: mock(),
    selectChatModels: mock(),
  },
  secrets: {
    get: mock(),
    store: mock(),
    delete: mock(),
  },
  workspace: {
    getConfiguration: mock(() => ({
      get: mock(),
      update: mock(),
    })),
  },
  CancellationTokenSource: mock(() => ({
    token: { isCancellationRequested: false },
    cancel: mock(),
    dispose: mock(),
  })),
  ExtensionContext: mock(),
  Uri: {
    parse: mock(),
  },
};

mock.module("vscode", () => enhancedMockVscode);

// Set up global test timeout
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = "test";
});

// Clean up after all tests
afterAll(() => {
  // Perform any global cleanup
});

// Reset state before each test
beforeEach(() => {
  // Clear any global state
  process.env.NODE_ENV = "test";
});

// Clean up after each test
afterEach(() => {
  // Clean up any test artifacts
});

// Mock console methods to reduce noise in tests unless explicitly testing logging
const originalConsole = { ...console };

export const mockConsole = () => {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
};

export const restoreConsole = () => {
  Object.assign(console, originalConsole);
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress Bun specific warnings in tests
process.env.BUN_QUIET = "1";
