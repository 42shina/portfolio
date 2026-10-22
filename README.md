# Portfolio

制作物・スキル・経歴を紹介するポートフォリオサイトです。フロントエンドとAWSの配信基盤を、このリポジトリで管理しています。

## 技術スタック

| 用途 | 技術 |
| --- | --- |
| フロントエンド | React / TypeScript / Vite |
| コンテンツ管理 | JSON |
| インフラ | Terraform / Amazon S3 / Amazon CloudFront |
| 開発環境 | Docker Compose / Node.js / npm |
| CI/CD | GitHub Actions |

## 構成

サイトの材料は `src/` にまとめています。HTML入口は `src/index.html`・`src/404.html`・`src/projects/`・`src/documents/`、Reactコンポーネント・CSS・JSONも `src/` 配下、画像などの静的ファイルは `src/public/` で管理します。

開発資料は `docs/`、AWS構成は `infra/`、補助ツールは `scripts/`、テストは `tests/`、CI/CDは `.github/workflows/` に分けています。Viteは `src/` を起点にビルドし、配信用ファイルをルートの `site/` に出力します。

Viteでビルドした静的ファイルを非公開S3に配置し、CloudFrontからHTTPSで配信する構成です。S3へのアクセスにはOACを使用します。

```text
Browser → CloudFront → private S3
```

## 開発方針

- TypeScriptのstrictモードで型を検証し、ビルド前に型チェックを実行します。
- ヘッダー・作品カードなどをReactコンポーネントに分割し、画面間で共有します。
- 文章や作品情報をJSONに分離し、表示ロジックとコンテンツを管理しやすくしています。

## CI/CD

- **起動条件**：PRの作成・更新、mainへのpush、Actions画面からの手動実行。
- **検証**：Node.js・npmの指定バージョン、TypeScriptの型、ルーティング・PDF用SSRなどのテスト、本番ビルド、Terraformの書式・構成をチェックします。
- **配信条件**：検証に成功し、mainを対象とするPR以外の実行で、配信が有効な場合（`DEPLOY_ENABLED=true`）に `production` 環境へデプロイします。同時デプロイは直列に処理します。
- **配信方法**：検証済みのビルド成果物を使い、OIDCでAWSに認証します。JS・CSSなどのアセットを先に、参照元のHTMLを後にS3へアップロードし、CloudFrontのキャッシュ無効化が完了するまで待機します。

毎日03:23 JSTにNode・npm・Dockerイメージ・プロジェクト依存を検査します。公開サマリーは重大度別件数のみとし、重大な検知や監視失敗でCIを失敗させます。詳細は [日次セキュリティ監視](docs/security-monitor.md) を参照してください。

## ローカル起動

```bash
docker compose up -d --build
```

[http://localhost:8081](http://localhost:8081) で表示できます。
