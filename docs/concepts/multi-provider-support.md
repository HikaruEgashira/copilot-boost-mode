# マルチプロバイダーサポート

## 実際の価値

VS CodeでGitHub Copilot以外のAIプロバイダーを使えるようにする拡張機能。

## サポートしているプロバイダー

### Anthropic
- Claude Sonnet 4
- APIキー設定: `copilot-boost-mode.anthropic.setKey`

### OpenAI
- GPT-4.1
- APIキー設定: `copilot-boost-mode.openai.setKey`

### Groq
- DeepSeek R1 Distill
- APIキー設定: `copilot-boost-mode.groq.setKey`

### Google Gemini
- Gemini 2.5 Flash
- APIキー設定: `copilot-boost-mode.gemini.setKey`

### OpenRouter
- 複数モデル対応
- APIキー設定: `copilot-boost-mode.openrouter.setKey`

## 技術的実装

- Vercel AI SDKを使用
- VS CodeのchatProvider APIに対応
- 各プロバイダーを統一インターフェースで提供

## ユーザーができること

1. APIキーを設定する
2. VS CodeのチャットでClaude、GPT-4、Gemini等を使い分ける
3. GitHub Copilot Chatと同じUIで異なるAIを利用する

## それだけです

これ以外の機能はありません。
シンプルに「複数のAIプロバイダーをVS Codeで使える」だけです。
