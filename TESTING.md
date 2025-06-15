# Testing Guide

This document describes how to run tests for the Copilot Boost Mode extension.

## Test Setup

The project uses two test frameworks:
- **[Bun](https://bun.sh/)** for unit and integration tests
- **[@vscode/test-electron](https://github.com/microsoft/vscode-test)** for VS Code extension tests

### Test Structure

```
tests/                    # All tests
├── unit/                 # Unit tests for individual components
├── integration/          # Integration tests for full workflows
├── e2e/                  # VS Code extension E2E tests
│   ├── runTest.ts        # Test runner entry point
│   └── suite/
│       ├── index.ts      # Mocha test suite configuration
│       └── extension.test.ts # Extension integration tests
├── mocks/                # Mock implementations for testing
├── performance/          # Performance benchmarks
├── utils/                # Test utilities
└── setup.ts              # Global test setup
```

## Prerequisites

1. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

## Running Tests

### All Tests
```bash
bun test
```

### Unit Tests Only
```bash
bun run test:unit
```

### Integration Tests Only
```bash
bun run test:integration
```

### Watch Mode
```bash
bun run test:watch
```

### Coverage Report
```bash
bun run test:coverage
```

### VS Code Extension Tests
```bash
bun run test:vscode
```

## Test Categories

### Unit Tests
- **Provider Tests**: Test individual language model providers (Anthropic, OpenAI, etc.)
- **Utility Tests**: Test helper functions and utilities
- **Component Tests**: Test individual components in isolation

### Integration Tests
- **Extension Activation**: Test full extension activation flow
- **Command Registration**: Test VS Code command registration
- **Provider Registration**: Test language model provider registration
- **End-to-End Workflows**: Test complete user workflows

### VS Code Extension Tests
- **API Integration**: Test VS Code API integration using `@vscode/test-electron`
- **Extension Host**: Test extension in actual VS Code environment
- **Extension Presence**: Verify extension is loaded and accessible
- **Basic Functionality**: Test core VS Code integration points

#### VS Code Test Setup
The VS Code integration tests use:
- `@vscode/test-electron` for running tests in VS Code environment
- `mocha` as the test framework for VS Code tests
- Separate TypeScript configuration (`tsconfig.test.json`)
- Test files located in `tests/e2e/` alongside other test categories

## Test Configuration

### bunfig.toml
```toml
[test]
timeout = 30000
bail = false
coverage = true
include = ["**/*.test.ts", "**/tests/**/*.ts"]
exclude = ["node_modules/**", "out/**", "**/*.d.ts"]
```

### Mocking Strategy

The test suite uses comprehensive mocking for:
- VS Code API (`vscode` module)
- AI SDK libraries (`@ai-sdk/*`)
- External dependencies

Example mock usage:
```typescript
import { mock } from "bun:test";

// Mock VS Code API
mock.module("vscode", () => mockVscode);

// Mock AI SDK
mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: mock(() => mock()),
}));
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `coverage/index.html` - HTML coverage report
- `coverage/lcov.info` - LCOV format for CI integration

## Continuous Integration

### GitHub Actions

Two workflows are configured:

1. **test.yml**: Runs unit and integration tests
   - Tests on Node.js 18 and 20
   - Generates coverage reports
   - Uploads VSIX artifacts

2. **vscode-test.yml**: Runs VS Code extension tests
   - Tests on Ubuntu, Windows, and macOS
   - Tests with VS Code stable and insiders
   - Includes display server setup for Linux

### Local Pre-commit Testing

Before committing, run:
```bash
bun run lint        # Code style checks
bun run test        # All tests
bun run compile     # Build verification
```

## Test Data and Fixtures

Test fixtures are located in `tests/fixtures/`:
- Sample configurations
- Mock API responses
- Test messages and conversations

## Debugging Tests

### VS Code Debugging
1. Open the project in VS Code
2. Set breakpoints in test files
3. Run "Debug Tests" configuration
4. Use VS Code's integrated debugging tools

### Bun Debugging
```bash
bun --inspect test
```
Then connect with Chrome DevTools at `chrome://inspect`

### Verbose Output
```bash
bun test --verbose
```

## Writing New Tests

### Unit Test Example
```typescript
import { describe, test, expect, mock } from "bun:test";

describe("MyComponent", () => {
  test("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### Integration Test Example
```typescript
import { describe, test, expect, beforeEach } from "bun:test";

describe("Extension Integration", () => {
  beforeEach(() => {
    // Setup mock context
  });

  test("should activate successfully", async () => {
    // Test activation flow
  });
});
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Mock External Dependencies**: Use mocks for VS Code API and external services
3. **Clear Test Names**: Use descriptive test names
4. **Setup/Teardown**: Use `beforeEach`/`afterEach` for clean state
5. **Async Handling**: Properly handle async operations
6. **Error Testing**: Test both success and failure cases

## Troubleshooting

### Common Issues

1. **Module Resolution**: Ensure TypeScript paths are correctly configured
2. **Mock Conflicts**: Clear mocks between tests using `beforeEach`
3. **Async Timing**: Use proper async/await patterns
4. **VS Code API**: Ensure VS Code mocks match expected interfaces

### Getting Help

- Check existing test files for examples
- Review Bun test documentation: https://bun.sh/docs/cli/test
- Check VS Code extension testing guide
- Open an issue for test-specific problems
