# GitHub ActionsによるCI/CD

対象は `42shina/portfolio` リポジトリです。設定は `.github/workflows/ci-cd.yml`、AWSの認証・権限は `infra/github-actions.tf` にあります。

## 実行される処理

- PR、mainへのpush、Actions画面からの手動実行で `npm ci` → `npm test` → `npm run build` → Terraformのfmt/init/validateを実行します。
- 検証済みの `site/` をartifactとして7日間保存します。
- mainかつRepository variableの `DEPLOY_ENABLED` が `true` の場合だけ、検証成功後にproductionへ配信します。PRからは配信しません。
- GitHub OIDCで一時的なAWS認証情報を取得し、画像・JS・CSS等を先に、HTMLを最後にS3へアップロードします。CloudFrontキャッシュ無効化の完了まで待機します。
- 配信ジョブは同時に実行しません。実行中のアップロードは後続pushで中断しません。

Terraformのstateはローカル管理のため、CIではAWS認証不要の静的検証だけを行います。インフラのplan/applyは管理端末で実行します。CIの成功はAWS上の差分や権限の確認を意味しません。

## 1. GitHubにproduction環境を作成

[リポジトリのSettings](https://github.com/42shina/portfolio/settings) → Environments → New environmentで、**production** を作成します。

Deployment branches and tagsで **Selected branches and tags** を選び、Branchの **main** だけを許可します。OIDCの信頼ポリシーは `repo:42shina/portfolio:environment:production` に限定しているため、環境側のブランチ制限も設定してください。GitHubプランによって利用可能な保護ルールが異なります。

## 2. AWSにデプロイ用IAMロールを作成

AWS CLIとTerraformを使える管理端末で実行します。既存リソースを管理している **同じTerraform state** と `terraform.tfvars` を使用してください。別リポジトリから移行した場合も、新しい空のstateでapplyせず、既存stateを安全に移行・バックアップします。

```bash
cd /home/shini47/projects/portfolio/infra
aws sts get-caller-identity
aws iam list-open-id-connect-providers
```

`terraform.tfvars` の既存設定を維持して、次を追記します。

```hcl
github_repository = "42shina/portfolio"
```

同じAWSアカウントに `token.actions.githubusercontent.com` のOIDC providerがすでにある場合は、そのARNも追記します。別のTerraform stateが管理するproviderを新しく作成・importしません。

```hcl
github_oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
```

既存providerのAudienceに `sts.amazonaws.com` が含まれることを確認してください。providerがない場合は、ARNの設定を省略するとTerraformが作成します。

```bash
terraform init -lockfile=readonly
terraform fmt -check
terraform validate
terraform plan -out=portfolio.tfplan
# IAMロール・ポリシーと、必要に応じたOIDC providerの作成を確認
# 既存インフラの未適用変更もplanに含まれるため、全体を確認してから実行
terraform apply portfolio.tfplan
terraform output -raw github_deploy_role_arn
terraform output -raw bucket_name
terraform output -raw distribution_id
terraform output -raw site_url
```

ロールの権限は、このサイトのS3バケットへの一覧取得・書き込みと、このCloudFront distributionのキャッシュ無効化・状態取得だけです。Terraform applyやS3オブジェクト削除の権限は付けません。

## 3. GitHub Variablesを設定

Settings → Environments → production → Environment variablesに登録します。いずれも **Variables** であり、AWSアクセスキーのSecrets登録は不要です。

| 名前 | 値 |
| --- | --- |
| `AWS_REGION` | `terraform.tfvars` のリージョン（通常 `ap-northeast-1`） |
| `AWS_ROLE_ARN` | `terraform output -raw github_deploy_role_arn` の値 |
| `S3_BUCKET_NAME` | `terraform output -raw bucket_name` の値 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output -raw distribution_id` の値 |

続いて、Settings → Secrets and variables → Actions → **Variables** の **Repository variables** に以下を登録します。

| 名前 | 値 |
| --- | --- |
| `DEPLOY_ENABLED` | `true` |

`DEPLOY_ENABLED` はジョブ開始前に判定するので **Environment variableではなくRepository variable** に置いてください。設定がなければCIだけ動き、配信はスキップされます。上記の初期設定を終えてから有効にします。

## 4. mainへ反映して初回実行

設定ファイルをGitHubへpushし、PRで `Test, build and validate` が成功することを確認してmainへマージします。ブランチ保護を使う場合はこのチェックを必須に設定できます。

mainへのpushでCIと配信が実行されます。ワークフローがmainへ反映済みなら、Actions → Portfolio CI/CD → Run workflow → **main** でも実行できます。

Actionsで両方のジョブが成功したら、`terraform output -raw site_url` のURLを開き、トップページ、`/projects/cozyctrl/`、`/projects/portfolio/`、存在しないURLの404を確認します。CloudFrontのディレクトリ補完などインフラ側の変更が残っている場合は、先に手順2で適用します。

## 通常の更新と切り戻し

`src/`、`public/` 等を変更 → PRのCI成功 → mainへマージ、で自動配信されます。`site/` のコミットは不要です。

切り戻しは、対象変更をrevertしたPRをmainへマージして再配信します。古いActionsの実行を再実行すると古い成果物で上書きされるため、通常の更新・切り戻しには使いません。自動配信の停止はRepository variableの `DEPLOY_ENABLED` を `false` にします（すでに実行中のジョブは必要ならActionsから停止）。

S3の削除同期は行いません。旧HTMLが参照するJS/CSSを残して更新時のリンク切れを減らしますが、削除したページもS3に残るため、公開を取りやめるページは管理者が対象オブジェクトを削除し、CloudFrontのキャッシュも無効化してください。複数HTMLの更新は原子的ではありません。

## よくある失敗

- **deployがSkipped**: main上の実行か、Repository variableの `DEPLOY_ENABLED` が文字列 `true` か確認します。
- **OIDCの認証エラー**: リポジトリ名の大文字小文字、`production` の名前、ロールARN、providerのAudienceを確認します。組織でOIDCのsubjectをカスタマイズしている場合は、信頼ポリシーの `sub` をその形式に合わせます。
- **S3 / CloudFrontのAccessDenied**: Variablesのバケット・distributionが、このTerraform stateの出力と一致しているか確認します。
- **Terraformのロックファイルエラー**: ローカルで依存変更を確認し、必要なら `terraform providers lock -platform=linux_amd64` を実行して `.terraform.lock.hcl` をコミットします。
- **無効化の待機タイムアウト**: CloudFront側で進行状況を確認します。アップロード済みなので、配信ジョブの失敗がそのままサイト停止を意味するわけではありません。

## 参考

- [GitHub: AWSとのOIDC連携](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [AWS: configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
- [AWS CLI: CloudFront無効化の完了待機](https://docs.aws.amazon.com/cli/latest/reference/cloudfront/wait/invalidation-completed.html)
