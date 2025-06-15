import { mock } from "bun:test";
import { createProviderTests, PROVIDER_CONFIGS } from "../../utils/provider-test-base";

// Import the global mock setup
import "../../setup";

// The utility functions will be mocked by the test base

// Mock logger
const mockLogger = {
  log: mock(),
  info: mock(),
  error: mock(),
  warn: mock()
};

mock.module("../../../src/logger", () => ({
  logger: mockLogger
}));

// Import the provider after mocking
import { AnthropicProvider } from "../../../src/providers/anthropic";

// Configure the provider test
const config = PROVIDER_CONFIGS.anthropic;
config.ProviderClass = AnthropicProvider;

// Run the comprehensive test suite
createProviderTests(config);
