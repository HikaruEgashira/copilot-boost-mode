import { describe, test, expect } from "bun:test";

// Import after mocking is set up in setup.ts
import { logger, channel } from "../../src/logger";

describe("Logger", () => {
  test("should create output channel", () => {
    // The channel should exist
    expect(channel).toBeDefined();
    expect(channel.name).toBe("Test Channel");
  });

  test("should log messages with LOG prefix", () => {
    logger.log("test message");
    expect(channel.appendLine).toHaveBeenCalledWith("[LOG] test message");
  });

  test("should log info messages", () => {
    logger.info("info message", { data: "value" });
    expect(channel.appendLine).toHaveBeenCalledWith('[INFO] info message {\n  "data": "value"\n}');
  });

  test("should log error messages", () => {
    const error = new Error("test error");
    logger.error("error occurred", error);
    expect(channel.appendLine).toHaveBeenCalled();
    const calls = (channel.appendLine as any).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall).toMatch(/^\[ERROR\] error occurred Error: test error/);
  });

  test("should log warning messages", () => {
    logger.warn("warning message");
    expect(channel.appendLine).toHaveBeenCalledWith("[WARN] warning message");
  });

  test("should handle objects in log messages", () => {
    logger.log("object:", { key: "value", nested: { prop: 123 } });
    expect(channel.appendLine).toHaveBeenCalledWith('[LOG] object: {\n  "key": "value",\n  "nested": {\n    "prop": 123\n  }\n}');
  });

  test("should handle multiple arguments", () => {
    logger.log("message", 123, true, { test: "data" });
    expect(channel.appendLine).toHaveBeenCalledWith('[LOG] message 123 true {\n  "test": "data"\n}');
  });

  test("should handle null and undefined values", () => {
    logger.log("values:", null, undefined);
    expect(channel.appendLine).toHaveBeenCalledWith("[LOG] values: null undefined");
  });

  test("should handle arrays", () => {
    logger.log("array:", [1, 2, 3]);
    expect(channel.appendLine).toHaveBeenCalledWith("[LOG] array: [\n  1,\n  2,\n  3\n]");
  });
});
