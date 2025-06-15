import { describe, test, expect } from "bun:test";

describe("Basic functionality", () => {
  test("should run basic tests", () => {
    expect(1 + 1).toBe(2);
  });

  test("should handle strings", () => {
    expect("hello").toBe("hello");
  });

  test("should handle arrays", () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr[0]).toBe(1);
  });

  test("should handle async operations", async () => {
    const promise = Promise.resolve("async result");
    const result = await promise;
    expect(result).toBe("async result");
  });

  test("should handle JSON operations", () => {
    const obj = { name: "test", value: 42 };
    const json = JSON.stringify(obj);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("test");
    expect(parsed.value).toBe(42);
  });
});
