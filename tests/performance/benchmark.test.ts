import { describe, test, expect, beforeAll, mock } from "bun:test";

/**
 * Performance benchmarking for the VS Code extension
 * Measures response times, memory usage, and throughput
 */

// Import global setup
import "../setup";

// Performance measurement utilities
class PerformanceMetrics {
  private measurements: { [key: string]: number[] } = {};

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const end = performance.now();
      if (!this.measurements[label]) {
        this.measurements[label] = [];
      }
      this.measurements[label].push(end - start);
    };
  }

  getStats(label: string) {
    const times = this.measurements[label] || [];
    if (times.length === 0) return null;

    const sorted = times.sort((a, b) => a - b);
    return {
      count: times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  clear() {
    this.measurements = {};
  }
}

const metrics = new PerformanceMetrics();

// Mock providers for performance testing
mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: mock(() => (model: string) => ({ model }))
}));

mock.module("ai", () => ({
  streamText: mock(async (config: any) => {
    // Simulate realistic API response times
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

    return {
      fullStream: {
        [Symbol.asyncIterator]: async function* () {
          const chunks = ["Hello", " world", "!", " This", " is", " a", " test", " response", "."];
          for (const chunk of chunks) {
            // Simulate streaming delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
            yield { type: "text-delta", textDelta: chunk };
          }
          yield { type: "finish" };
        }
      }
    };
  })
}));

// Mock VS Code API
const mockVSCode = {
  workspace: {
    getConfiguration: mock(() => ({
      get: mock(() => "claude-sonnet-4-20250514")
    }))
  },
  window: {
    showErrorMessage: mock(),
    createOutputChannel: mock(() => ({
      appendLine: mock(),
      show: mock(),
      dispose: mock()
    }))
  },
  commands: {
    executeCommand: mock()
  }
};

mock.module("vscode", () => mockVSCode);

// Mock logger
mock.module("../../src/logger", () => ({
  logger: {
    log: mock(),
    info: mock(),
    error: mock(),
    warn: mock()
  }
}));

import { AnthropicProvider } from "../../src/providers/anthropic";

describe("Performance Benchmarks", () => {
  let provider: AnthropicProvider;

  beforeAll(() => {
    provider = new AnthropicProvider("test-api-key");
  });

  describe("Response Time Benchmarks", () => {
    test("should measure basic text generation performance", async () => {
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const stopTimer = metrics.startTimer("basic-text-generation");

        const mockProgress = { report: mock() };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };

        await provider.provideLanguageModelResponse(
          [{ role: 1, content: "Hello" }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        );

        stopTimer();
      }

      const stats = metrics.getStats("basic-text-generation");
      expect(stats).toBeDefined();
      expect(stats!.mean).toBeLessThan(200); // Should complete within 200ms on average
      expect(stats!.p95).toBeLessThan(500);  // 95% should complete within 500ms

      console.log("Basic Text Generation Performance:", stats);
    }, 30000); // 30 second timeout for performance test

    test("should measure tool call performance", async () => {
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const stopTimer = metrics.startTimer("tool-call-generation");

        const mockProgress = { report: mock() };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };

        const tools = [{
          name: "get_weather",
          description: "Get weather information",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" }
            }
          }
        }];

        await provider.provideLanguageModelResponse(
          [{ role: 1, content: "What's the weather?" }],
          { tools },
          "test-extension",
          mockProgress,
          mockToken
        );

        stopTimer();
      }

      const stats = metrics.getStats("tool-call-generation");
      expect(stats).toBeDefined();
      expect(stats!.mean).toBeLessThan(300); // Tool calls may take slightly longer

      console.log("Tool Call Performance:", stats);
    }, 30000);

    test("should measure concurrent request performance", async () => {
      const concurrentRequests = 5;
      const stopTimer = metrics.startTimer("concurrent-requests");

      const promises = Array.from({ length: concurrentRequests }, async () => {
        const mockProgress = { report: mock() };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };

        return provider.provideLanguageModelResponse(
          [{ role: 1, content: "Concurrent test" }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        );
      });

      await Promise.all(promises);
      stopTimer();

      const stats = metrics.getStats("concurrent-requests");
      expect(stats).toBeDefined();
      expect(stats!.mean).toBeLessThan(1000); // All concurrent requests within 1 second

      console.log("Concurrent Requests Performance:", stats);
    }, 30000);
  });

  describe("Memory Usage Benchmarks", () => {
    test("should not leak memory during repeated operations", async () => {
      // Measure initial memory
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        const mockProgress = { report: mock() };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };

        await provider.provideLanguageModelResponse(
          [{ role: 1, content: `Test message ${i}` }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log("Memory Usage:", {
        initial: Math.round(initialMemory.heapUsed / 1024 / 1024) + "MB",
        final: Math.round(finalMemory.heapUsed / 1024 / 1024) + "MB",
        increase: Math.round(memoryIncrease / 1024 / 1024) + "MB"
      });

      // Memory increase should be reasonable (less than 50MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 60000);
  });

  describe("Throughput Benchmarks", () => {
    test("should maintain throughput under load", async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let completedRequests = 0;

      while (Date.now() - startTime < duration) {
        const mockProgress = { report: mock() };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };

        await provider.provideLanguageModelResponse(
          [{ role: 1, content: "Throughput test" }],
          {},
          "test-extension",
          mockProgress,
          mockToken
        );

        completedRequests++;
      }

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (completedRequests / actualDuration) * 1000;

      console.log("Throughput:", {
        requests: completedRequests,
        duration: actualDuration + "ms",
        rps: requestsPerSecond.toFixed(2)
      });

      // Should handle at least 5 requests per second
      expect(requestsPerSecond).toBeGreaterThan(5);
    }, 10000);
  });

  describe("Resource Efficiency", () => {
    test("should efficiently handle large message histories", async () => {
      // Create a large message history
      const largeHistory = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 1 : 2, // Alternate between user and assistant
        content: `Message ${i}: This is a longer message to test how the provider handles large conversation histories with substantial content.`
      }));

      const stopTimer = metrics.startTimer("large-history");

      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      await provider.provideLanguageModelResponse(
        largeHistory,
        {},
        "test-extension",
        mockProgress,
        mockToken
      );

      stopTimer();

      const stats = metrics.getStats("large-history");
      expect(stats).toBeDefined();
      expect(stats!.mean).toBeLessThan(1000); // Should handle large histories efficiently

      console.log("Large History Performance:", stats);
    });

    test("should handle complex tool schemas efficiently", async () => {
      const complexTools = Array.from({ length: 10 }, (_, i) => ({
        name: `complex_tool_${i}`,
        description: `A complex tool with many parameters for testing performance`,
        parameters: {
          type: "object",
          properties: Array.from({ length: 20 }, (_, j) => ({
            [`param_${j}`]: {
              type: j % 3 === 0 ? "string" : j % 3 === 1 ? "number" : "boolean",
              description: `Parameter ${j} for testing complex schemas`
            }
          })).reduce((acc, param) => ({ ...acc, ...param }), {})
        }
      }));

      const stopTimer = metrics.startTimer("complex-tools");

      const mockProgress = { report: mock() };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: mock(() => ({ dispose: mock() }))
      };

      await provider.provideLanguageModelResponse(
        [{ role: 1, content: "Use complex tools" }],
        { tools: complexTools },
        "test-extension",
        mockProgress,
        mockToken
      );

      stopTimer();

      const stats = metrics.getStats("complex-tools");
      expect(stats).toBeDefined();
      expect(stats!.mean).toBeLessThan(500); // Should handle complex tools efficiently

      console.log("Complex Tools Performance:", stats);
    });
  });
});
