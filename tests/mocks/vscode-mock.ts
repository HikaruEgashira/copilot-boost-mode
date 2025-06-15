import { mock } from "bun:test";

/**
 * Comprehensive VS Code API mock for testing
 * Provides realistic simulation of VS Code's extension APIs
 */

export class MockVSCode {
  private static apiKeys = new Map<string, string>();
  private static configurations = new Map<string, any>();

  static reset() {
    this.apiKeys.clear();
    this.configurations.clear();
  }

  static setApiKey(provider: string, key: string) {
    this.apiKeys.set(provider, key);
  }

  static setConfiguration(section: string, config: any) {
    this.configurations.set(section, config);
  }

  static createMockVSCode() {
    return {
      // Extension Context
      ExtensionContext: class {
        subscriptions: any[] = [];
        secrets = {
          get: mock(async (key: string) => this.apiKeys.get(key)),
          store: mock(async (key: string, value: string) => {
            this.apiKeys.set(key, value);
          }),
          delete: mock(async (key: string) => {
            this.apiKeys.delete(key);
          })
        };
        globalState = {
          get: mock(),
          update: mock()
        };
        workspaceState = {
          get: mock(),
          update: mock()
        };
      },

      // Workspace API
      workspace: {
        getConfiguration: mock((section?: string) => ({
          get: mock((key: string, defaultValue?: any) => {
            const config = this.configurations.get(section || "");
            return config?.[key] ?? defaultValue;
          }),
          update: mock(async (key: string, value: any) => {
            const config = this.configurations.get(section || "") || {};
            config[key] = value;
            this.configurations.set(section || "", config);
          }),
          has: mock((key: string) => {
            const config = this.configurations.get(section || "");
            return config && key in config;
          })
        }))
      },

      // Window API
      window: {
        createOutputChannel: mock(() => ({
          appendLine: mock(),
          show: mock(),
          hide: mock(),
          dispose: mock(),
          name: "Test Channel",
          append: mock(),
          clear: mock(),
          replace: mock()
        })),
        showErrorMessage: mock(async (message: string, ...items: string[]) => {
          // Simulate user clicking the first item
          return items[0];
        }),
        showInformationMessage: mock(async (message: string, ...items: string[]) => {
          return items[0];
        }),
        showWarningMessage: mock(),
        showInputBox: mock(async (options?: any) => {
          return "mock-input-value";
        })
      },

      // Commands API
      commands: {
        registerCommand: mock((command: string, callback: any) => ({
          dispose: mock()
        })),
        executeCommand: mock(async (command: string, ...args: any[]) => {
          // Mock common commands
          if (command === "workbench.action.reloadWindow") {
            return;
          }
          return {};
        })
      },

      // Language Model Classes
      LanguageModelChatMessage: class {
        constructor(public role: number, public content: string | any[]) {}
      },

      LanguageModelTextPart: class {
        constructor(public value: string) {}
      },

      LanguageModelToolCallPart: class {
        constructor(public callId: string, public name: string, public input: any) {}
      },

      LanguageModelToolResultPart: class {
        constructor(public callId: string, public result: any) {}
      },

      // Language Model Enums
      LanguageModelChatMessageRole: {
        User: 1,
        Assistant: 2,
        System: 0
      },

      LanguageModelChatToolMode: {
        Auto: 1,
        Required: 2
      },

      // Progress and Cancellation
      Progress: class {
        report = mock();
      },

      CancellationToken: class {
        isCancellationRequested = false;
        onCancellationRequested = mock(() => ({ dispose: mock() }));
      },

      CancellationTokenSource: class {
        token = {
          isCancellationRequested: false,
          onCancellationRequested: mock(() => ({ dispose: mock() }))
        };
        cancel = mock();
        dispose = mock();
      },

      // Chat Response
      ChatResponseFragment2: class {
        constructor(public value: string) {}
      },

      // Event Emitter
      EventEmitter: class {
        fire = mock();
        event = mock();
        dispose = mock();
      },

      // Disposable
      Disposable: class {
        static from = mock((...disposables: any[]) => ({
          dispose: mock()
        }));
        dispose = mock();
      },

      // URI
      Uri: {
        parse: mock((path: string) => ({ path, scheme: "file" })),
        file: mock((path: string) => ({ path, scheme: "file" }))
      }
    };
  }
}

// Export singleton instance
export const mockVscode = MockVSCode.createMockVSCode();
