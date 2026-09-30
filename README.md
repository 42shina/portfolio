# Portfolio

React/Viteで構築するポートフォリオと、非公開S3＋CloudFrontのTerraform構成です。

## Dockerでローカル表示（ホットリロード）

リポジトリのルートで実行します。

```bash
docker compose up -d
```

ブラウザで http://localhost:8081 を開きます。`src/` や `src/content/` を編集すると自動で反映されます。停止するには `docker compose down` を実行します。

## ローカル開発とコンテンツの更新

Node.js 22以上を用意し、リポジトリのルートで実行します。

```bash
npm ci
npm run dev
```

`npm run build` で配信用ファイルが `site/` に生成されます。`site/` は生成物なので直接編集しません。

更新する文章や項目は `src/content/` のセクション別JSONで管理します。作品は `src/content/projects/` に1作品1ファイルで置き、`src/content/index.js` に読み込みと表示順を追加するとカードが増えます。あわせて `projects/<id>/index.html` を追加すると、ビルド時に `/projects/<id>/` の詳細ページが出力されます（既存HTMLをコピーしてタイトルとdescriptionだけ変えれば足ります）。`visual` は既存の `portfolio`、`cozyctrl` から選び、新しい図柄が必要なら `src/components/ProjectVisual.jsx` に追加します。トップのカードは概要のみ、`details`・外部 `link` は詳細ページに表示します。タグは `{ "name": "React", "kind": "frontend" }` 形式で、`frontend` / `backend` / `infra` により色が付きます（`kind` 省略時はグレー）。構成図は `public/diagrams/` に置き、作品JSONの `diagrams` 配列で参照します。`link` を `null` にした場合は `pendingLinkText` が表示されます。

トップは `src/App.jsx`、作品詳細は `src/components/ProjectPage.jsx`、カードは `src/components/ProjectCard.jsx`、配色・レイアウトは `src/styles.css` です。`public/` にはアイコンと404ページを置いています。作品の図は実画面のスクリーンショットではなく、構成を示すイメージです。CloudFrontにSPA用の200フォールバックはないため、詳細は実HTMLとしてビルドします。

`skillsTitle` / `skillGroups` で対応範囲を管理します。各グループには `description`、各スキルには経験の場を示す `context`、担当作業の `works`、根拠や相談条件の `evidence`、任意の事例リンク `href` を記載します。経過年数によるスキルバーは使用しません。

トップの対応業務は `hero.json` の `services`、作品カードの課題・対応などは作品JSONの `highlights`、職歴の担当領域は `career.json` の `responsibilities`、ご依頼の条件は `contact.json` の `conditions` で更新します。実務の具体的な担当機能・担当範囲は `career.json` の「実務での担当実績」に掲載しています。希望業務はWebアプリ開発、稼働は週16時間未満、主な対応は土日祝日と平日夜、平日日中はチャットと短時間のお打ち合わせのみです。改善成果の数値や各実績と勤務先の対応は、本人に確認できたものだけを追記してください。CozyCtrlの所属人数は実利用者数と分け、削減時間・費用の実測値や実画面は確認できたものだけを追加します。

## ポートフォリオ・職務経歴書のPDF出力

「実務での担当実績」は `career.json` の `points` に1実績ずつ記載します。`period` はこの項目では実績名、`text` は担当内容、`responsibilities` の「ポジション」は担当した役割です。各実績の `skills` に `{ "name": "React", "kind": "frontend" }` の形式で使用技術を追加できます（`kind` は `frontend` / `backend` / `infra`）。空の `skills` は表示されません。仮置きの使用技術には `skillsProvisional: true` を付けると、サイトと職務経歴書に「使用技術（仮・要確認）」と表示されます。内容を確認・修正したら、このフラグを削除するか `false` にしてください。

トップページの「ポートフォリオをPDFで保存」を押すと、元のサイトをブラウザの印刷機能でPDF保存できます。サイトの配色・図・掲載内容を使い、印刷時には保存ボタンを非表示にします。職務経歴書は専用ページ（`/documents/resume/`）の「PDFに保存 / 印刷」から保存します。旧 `/documents/portfolio/` はトップページへ移動します。

印刷画面で保存先を「PDFに保存」、用紙をA4、余白を「既定」に設定してください。`src/styles.css` の共通 `@page` 設定で、ポートフォリオ・職務経歴書ともに各ページの四辺に15mmの白い余白を確保します。「余白なし」やカスタム余白を指定するとブラウザ側の設定が優先される場合があるため、「既定」に戻してください。ヘッダーとフッターをオフにするとURLや日付を省けます。背景色が出ない場合は「背景のグラフィック」を有効にしてください。PDFファイルの自動ダウンロードではなく、ブラウザの印刷機能を使います。

情報源は既存の `src/content/` のJSONです。職務経歴書の氏名表記は `brand.json`、職務要約は `hero.json` の `intro`、職歴・担当実績・学歴・資格は `career.json`、希望条件・連絡先は `contact.json` を参照します。JSONにない氏名・勤務先名・実績数値は補完しません。

サイトの印刷用スタイルは `src/styles.css`、職務経歴書は `src/components/DocumentPage.jsx` と `src/components/documents.css` で管理します。開発中はJSONの更新も自動反映されます。

## 非公開の氏名・メールアドレスを入れた職務経歴書をCLIで生成

Node.js 22以上で、リポジトリのルートから実行します。初回に依存関係とPDF生成用のChromiumをインストールしてください。

```bash
npm ci
npx playwright install chromium
```

リポジトリ直下の `.env` に氏名とメールアドレスを設定します。新しい環境では `.env.example` をコピーしてください。既存の `.env` がある場合は、以下の2項目を追記します。

```dotenv
RESUME_NAME="山田 太郎"
RESUME_EMAIL="taro@example.com"
```

```bash
npm run resume:pdf
npm run resume:pdf -- --output .private/application.pdf
```

`.private/resume.pdf` が生成されます。CLIは `.env` を直接読み込みます。`source .env` やDocker Composeの `env_file` 設定は不要です。変数名に `VITE_` を付けないでください。`.env` はGit管理から除外され、設定値を公開ビルドのクライアントデータへ渡しません。

別の.envファイルを使う場合は `npm run resume:pdf -- --env-file .private/resume.env` を実行します。以前の `--name` / `--email` と `--profile .private/resume.json` も使えます。値の優先順位は **CLI引数 > JSON設定 > シェル環境変数 > .env** です。`--help` で使い方を表示できます。

既存のPDFを上書きする場合は `--force` を付けます。Linuxでブラウザのシステムライブラリが不足する場合は `npx playwright install --with-deps chromium` を実行してください。インストール済みのChrome/Chromiumを使う場合は `--browser /path/to/chrome` も指定できます。

公開サイトと同じ職務経歴書コンポーネント・コンテンツ・15mmの余白を使い、生成時だけ氏名とメールアドレスを差し替えます。氏名・メールアドレスを公開JSON・ビルド成果物に書き込まず、ブラウザから外部への通信も行いません。`.private/` はGit管理から除外しています。リポジトリ内の出力先は `.private/` 配下に限定し、配信用の `site/` や `public/` への保存を拒否します。リポジトリ外のローカルフォルダーも `--output` で指定できます。

Dockerで開発している場合は、コンテナ内にChromiumを用意して実行できます。生成したファイルをWSLの自分のユーザーで読み書きできるよう、生成時にはユーザーIDを指定します。

```bash
docker compose exec portfolio npm ci
docker compose exec -e PLAYWRIGHT_BROWSERS_PATH=/tmp/resume-browsers portfolio npx playwright install --with-deps chromium
docker compose exec --user "$(id -u):$(id -g)" -e PLAYWRIGHT_BROWSERS_PATH=/tmp/resume-browsers portfolio npm run resume:pdf
```

PDF生成用のViteキャッシュはOSの一時フォルダーに実行ごとに作成し、終了時に削除します。開発サーバーの `node_modules/.vite` キャッシュを共有しないため、Docker内のキャッシュ所有者が異なっても生成できます。

Chromiumのインストールはコンテナを作り直した場合にも必要です。公開サイトのビルド・配信は通常どおり `npm run build` で行います。

## ルーティングの検証

`npm test` でCloudFront Functionの書き換えとReactのページ選択を検証します。`npm run build` と `terraform -chdir=infra validate` も実行してください。実装は[AWS公式のディレクトリURL補完例](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html)に沿っています。

## AWS構成

```text
Browser ── HTTPS ── CloudFront ── OAC / SigV4 ── private S3
```

構成図のソースは `docs/architecture/portfolio-aws.drawio`、詳細ページ表示用は `public/diagrams/portfolio-aws.svg` です。draw.io で編集したあとは次で SVG を再出力できます。

```bash
docker run --rm \
  -v "$PWD/docs/architecture:/data" \
  -v "$PWD/public/diagrams:/out" \
  rlespinasse/drawio-desktop-headless:latest \
  --export --format svg --output /out/portfolio-aws.svg /data/portfolio-aws.drawio
```

- S3のパブリックアクセスを全面ブロックし、対象CloudFrontからのみ読み取りを許可します。
- S3のwebsite endpointを使わず、通常のS3 originを使います。
- viewer-request の CloudFront Function が `/projects/cozyctrl/` を `/projects/cozyctrl/index.html` に内部書き換えします。末尾 `/` のない拡張子なしURLにも対応し、ブラウザのURLは変えません。React側は `index.html` 付きの直接アクセスにも対応します。
- HTTPからHTTPSへリダイレクト。最初はCloudFront標準ドメインと証明書を利用します。
- キャッシュは最小0秒、既定300秒、最大1日。公開時に無効化します。
- 不明なパスは `404.html` とHTTP 404を返します。SPA用の200フォールバックはありません。
- S3は東京リージョン、CloudFrontは日本を含む `PriceClass_200`。従量課金が発生します。
- 独自ドメイン、Route 53、ACMはまだ含みません。CI/CDはGitHub Actionsで構成します。

OACの設計は[AWS公式ドキュメント](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)に基づきます。

## インフラ作成（AWSリソースが作成されます）

必要なもの: Terraform 1.6以上、AWS CLI、対象アカウントのAWS認証情報。長期アクセスキーをソースに書かず、AWSプロファイルやSSO等を使ってください。

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars の project_name を必要に応じて変更
aws sts get-caller-identity
terraform init
terraform fmt -check
terraform validate
terraform plan -out=portfolio.tfplan
# 対象アカウント・作成内容を確認してから実行
terraform apply portfolio.tfplan
```

同じアカウントに複数環境を作る場合は `project_name` を変えてください。生成される `.terraform.lock.hcl` はGitに含めます。state・tfvars・planはGit対象外です。stateは初期状態ではローカル管理なので保管が必要です。チーム運用前にリモートbackendを設定してください。

## CI/CD（GitHub Actions）

PRでテスト・ビルド・Terraform検証を実行し、mainへの反映後にS3＋CloudFrontへ自動配信します。AWS認証はOIDCを使用します。初期状態では配信を無効にしているため、[CI/CDの初期設定手順](docs/ci-cd.md)に従ってIAMロール・GitHub Variablesを設定してください。

## サイトを公開・更新

リポジトリのルートでビルドし、続くAWSコマンドは `infra/` 内で実行します。削除同期は行いません。

```bash
npm ci
npm run build
cd infra
PORTFOLIO_BUCKET="$(terraform output -raw bucket_name)"
PORTFOLIO_DISTRIBUTION="$(terraform output -raw distribution_id)"
aws s3 sync ../site/ "s3://${PORTFOLIO_BUCKET}/" --cache-control 'public,max-age=300'
aws cloudfront create-invalidation --distribution-id "$PORTFOLIO_DISTRIBUTION" --paths '/*'
terraform output -raw site_url
```

CloudFrontの反映完了後、トップページと `/projects/cozyctrl/`、`/projects/portfolio/`、各詳細の末尾 `/` なし・`index.html` 付きURLが200で正しい内容を表示すること、存在しないパスが404で表示されること、HTTPがHTTPSに転送されることを確認します。更新はキャッシュ無効化の完了まで数分かかる場合があります。S3へアップロードするのは `site/` の中身だけで、stateや設定ファイルを含めないでください。

このサイトの編集では `terraform apply` やS3アップロードを行っていません。

## 既存環境の引き継ぎ

このリポジトリは `my_life/portfolio` のソースを独立させたものです。以前のリポジトリのコミット履歴は含みません。

既存AWS環境を管理する場合は、旧作業ディレクトリの `infra/terraform.tfstate` と `infra/terraform.tfvars` を安全な方法で新しい `infra/` に引き継いでください。これらはGit対象外です。stateなしで既存環境に `terraform apply` しないでください。古い保存済みplanは再利用せず、`terraform init` と新しい `terraform plan` を実行し、リソースの再作成や削除がないことを確認します。以後のインフラ更新はこのリポジトリから実行してください。

CloudFront Functionの追加はTerraformの適用、Reactの変更は再ビルドした `site/` のアップロードとキャッシュ無効化で反映します。
