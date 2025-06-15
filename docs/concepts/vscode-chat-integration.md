# VS Code チャット統合

## 統合の仕組み

VS CodeのproposedApi `chatProvider`を使用して、複数のAIプロバイダーをチャットUIに統合。

## 実装の詳細

### プロバイダー登録
```typescript
vscode.lm.registerChatModelProvider("anthropic", new AnthropicProvider(apiKey), {
  vendor: "boost",
  name: "Anthropic",
  // ...
});
```

### 対応機能
- ストリーミングレスポンス
- チャット履歴
- キャンセレーション
- ツール呼び出し

## ユーザーの体験

1. VS CodeのチャットUIを開く
2. プロバイダーを選択（Anthropic, OpenAI, Groq, Gemini, OpenRouter）
3. GitHub Copilot Chatと同じように使える

## 制限

- VS Code Insiders版が必要（proposed API使用のため）
- GitHub Copilot Chat拡張機能が必要

## 実装の単純さ

各プロバイダーはVercel AI SDKでラップされ、VS CodeのLanguageModelChatProviderインターフェースを実装するだけ。

技術的にはシンプルなプロキシ実装です。
