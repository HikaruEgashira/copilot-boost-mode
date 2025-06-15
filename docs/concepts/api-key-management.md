# APIキー管理

## 基本機能

各AIプロバイダーのAPIキーをVS Code Secrets APIに保存。

## 対応プロバイダー

- Anthropic API Key
- OpenAI API Key
- Groq API Key
- Gemini API Key
- OpenRouter API Key

## 設定方法

### コマンドパレットから設定
- `copilot-boost-mode.anthropic.setKey`
- `copilot-boost-mode.openai.setKey`
- `copilot-boost-mode.groq.setKey`
- `copilot-boost-mode.gemini.setKey`
- `copilot-boost-mode.openrouter.setKey`

### macOS特別機能
`copilot-boost-mode.anthropic.setClaudeCodeKey`
- macOSキーチェーンからClaude CodeのAPIキーを自動取得

## セキュリティ

- VS Code Secrets APIで暗号化保存
- APIキーはログに出力されない
- 拡張機能終了時に削除

## 実装

```typescript
// 保存
await context.secrets.store(keyName, apiKey);

// 取得
const apiKey = await context.secrets.get(keyName);
```

シンプルなラッパー実装です。
