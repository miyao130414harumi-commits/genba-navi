# 現場ナビ AI — 建設現場管理プラットフォーム

スパイダープラス・Photoruction・eYACHO・PRDOUGUを超えるAI搭載SaaS。

## 機能一覧

| 機能 | 内容 |
|------|------|
| 図面管理・ピン | PDF表示、ピン配置、指摘事項管理 |
| AI自然言語検索 | 「3階電気図面」→ 該当図面を自動表示 |
| AI写真解析 | 不具合を自動分類（重要度・種別・推奨対応） |
| 検査チェックリスト | AIでリスト自動生成・帳票出力 |
| AI報告書生成 | 写真＋指摘事項→ 報告書を自動下書き |
| AIリスク予測 | 指摘事項から将来リスクを予測 |
| ダッシュボード | 工事進捗・指摘サマリー |
| GASバックエンド | Google Sheets＋Drive連携 |

## ファイル構成

```
genba-navi/
├── index.html              # エントリポイント（PWA対応）
├── public/
│   └── manifest.json       # PWAマニフェスト
├── src/
│   ├── main.js             # アプリ本体・ルーティング
│   ├── store.js            # 状態管理
│   ├── styles/
│   │   └── main.css        # デザインシステム
│   ├── utils/
│   │   ├── ai.js           # Claude API連携
│   │   └── toast.js        # 通知・モーダル
│   └── pages/
│       ├── dashboard.js    # ダッシュボード
│       ├── drawings.js     # 図面管理
│       ├── checklist.js    # チェックリスト
│       ├── reports.js      # 報告書
│       └── photos.js       # 写真管理
└── gas/
    └── Code.gs             # GASバックエンド（Google Sheets連携）
```

## セットアップ

### 1. フロントエンド（ローカル確認）

```bash
# Python で簡易サーバー起動
cd genba-navi
python3 -m http.server 8080
# → http://localhost:8080 で確認
```

### 2. GitHub Pages でデプロイ（無料）

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/genba-navi.git
git push -u origin main
# GitHub → Settings → Pages → main ブランチを有効化
```

### 3. GASバックエンド設定

1. [script.google.com](https://script.google.com) で新規プロジェクト作成
2. `gas/Code.gs` の内容をコピー＆ペースト
3. スクリプトプロパティを設定:
   - `SPREADSHEET_ID` → Google SpreadsheetsのID
   - `DRIVE_FOLDER_ID` → 写真保存先フォルダのID
4. `setup()` 関数を一度実行
5. デプロイ → Webアプリ → URLをコピー

### 4. フロントエンドにGAS URLを設定

`src/utils/ai.js` の先頭にGAS URLを追加:

```js
export const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

### 5. Claude API（AI機能）

`src/utils/ai.js` はAnthropicのAPIをそのまま呼んでいます。  
**本番環境ではバックエンド（GAS）経由でAPIを呼ぶことを推奨**（APIキーを隠すため）。

GAS側での中継例:
```js
function callClaudeAPI(prompt, imageBase64) {
  const key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    payload: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  });
  return JSON.parse(res.getContentText());
}
```

## フェーズ別実装ロードマップ

- **Phase 1（現在）**: 図面・ピン・チェックリスト・報告書・写真管理
- **Phase 2**: マルチテナント認証・Firebase移行
- **Phase 3**: Stripe課金・管理者ダッシュボード・API公開
- **Phase 4**: 音声入力・図面差分AI・不具合予測モデル強化

## ライセンス

MIT
