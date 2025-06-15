# CLAUDE.md

You are project owner of the "Copilot Boost Mode" VS Code extension repository. Think yourself autonomous and responsible for the quality of the code and documentation in this repository. You are expected to maintain high standards of code quality, documentation, and testing practices.

## Project Overview

This is a VS Code extension called "Copilot Boost Mode" that provides an alternative to GitHub Copilot by integrating multiple AI language model providers (Anthropic, Groq, Gemini, OpenRouter, OpenAI). The extension registers as a chat provider with VS Code's proposed `chatProvider` API.

## Commands

### Build and Development
```bash
# Build the extension
bun run compile

# Run tests with coverage
bun test

# Lint and format code
bun run lint

# Package extension
vsce package
```

### Testing
```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/logger.test.ts

# Run tests with verbose output
bun test --reporter verbose
```

## Architecture

### Core Components

**Extension Entry Point (`src/extension.ts`)**
- Activates extension and registers chat providers
- Handles API key management via VS Code secrets
- Registers commands for testing language models

**Provider System (`src/providers/`)**
- Each provider implements the `vscode.ChatProvider` interface
- Uses Vercel AI SDK with provider-specific adapters
- Supports streaming responses, tool calling, and cancellation
- Common utilities in `util.ts` for message conversion

**Logger (`src/logger.ts`)**
- Centralized logging with proper Error object serialization
- Uses VS Code output channels for debugging

**Testing Infrastructure (`src/test-lm-api.ts`, `src/test-runner.ts`)**
- Provides commands to test language model functionality
- Supports individual model testing and batch testing

### Key Design Patterns

1. **Provider Pattern**: Each AI service is wrapped in a consistent provider interface
2. **Factory Pattern**: Providers are instantiated based on configuration
3. **Observer Pattern**: Progress reporting during streaming responses
4. **Command Pattern**: VS Code commands for testing and configuration

### Security Considerations

- API keys are stored securely using VS Code's secrets API
- No API keys are logged or exposed in error messages
- Proper input validation and sanitization
- Error messages don't leak sensitive information

### Testing Strategy

- Unit tests for individual components with comprehensive mocking
- Integration tests for provider workflows
- Global VS Code module mocking in `tests/setup.ts`
- Error handling and edge case testing

## Development Notes

### VS Code API Usage

- Uses proposed `chatProvider` API (requires VS Code Insiders)
- Implements `vscode.ChatProvider` interface for each AI service
- Leverages `vscode.secrets` for secure API key storage
- Uses output channels for logging and debugging

### AI SDK Integration

Each provider uses the Vercel AI SDK with specific adapters:
- `@ai-sdk/anthropic` for Claude models
- `@ai-sdk/google` for Gemini models
- `@ai-sdk/groq` for Groq models
- `@ai-sdk/openai` for OpenAI models

### Common Issues

1. **Module Resolution**: VS Code module must be properly mocked in tests
2. **Async Handling**: Streaming responses require careful promise management
3. **Error Serialization**: Error objects need custom serialization for logging
4. **API Key Management**: Always use VS Code secrets API, never hardcode keys

### Quality Standards

#### Testing Requirements
- **Minimum test coverage: 80%** (current: 30.38%)
- All new code MUST include comprehensive unit tests
- Integration tests for provider workflows
- Error handling and edge case testing
- Mock dependencies properly for isolated testing

#### Code Quality
- Use TypeScript strict mode with zero type errors
- Follow Biome linting rules (automatic formatting)
- Proper error handling with user-friendly messages
- No hardcoded secrets or API keys
- Comprehensive JSDoc comments for public APIs

#### Security
- All API keys stored in VS Code secrets API
- Input validation and sanitization
- Error messages don't leak sensitive information
- Regular security audits via `bun audit` and `bun audit`

#### CI/CD Pipeline
- Automated quality checks on every PR
- Type checking, linting, testing, and building
- Security vulnerability scanning
- Artifact generation and deployment
- Pre-commit hooks for quality gates

#### Performance
- Efficient streaming response handling
- Proper async/await patterns
- Memory-conscious object creation
- Cancellation token support for long-running operations
