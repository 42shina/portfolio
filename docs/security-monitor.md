# 日次セキュリティ監視

GitHub Actionsの `Daily security monitor` が、既定ブランチmainを毎日03:23 JST（18:23 UTC）に検査します。関連する依存・Docker・監視設定のmainへの変更時と、Actions画面からの手動実行にも対応します。定期実行には遅延・取りこぼしがあり、公開リポジトリは60日間活動がないとGitHub側で定期実行が停止することがあります。

## 対象

| 対象 | 検査方法 |
| --- | --- |
| プロジェクト依存 | 公開用・開発用を含めたpackage-lock.jsonをnpm auditで検査。プロジェクトのインストールやinstall scriptsの実行は不要 |
| npm本体 | Dockerfileから実際に構築したイメージ内のnpmと同梱依存を列挙し、npmレジストリのadvisory APIと照合 |
| Dockerイメージ | Dockerfileを `--pull` 付きで構築し、そのイメージのアーカイブをGrypeで検査。OSパッケージと検出できる言語パッケージを対象にする |
| Node.js | 実イメージのNode/npmが `.node-version`・Dockerfile・packageManagerと一致することを確認。Node公式Security WGのcore DB、公式リリース一覧、サポート期限、公式security RSSを照合 |

Node公式DBでは影響範囲に該当し、修正版の範囲に入らないLinux向け項目を検知します。DB反映の遅れを補うため、同じメジャー系列の後続securityリリース、EOL、新しい公式securityリリース告知も更新・要確認シグナルとして扱います。新しい告知は対象系列をRSSだけでは確定できないため、保守的な確認要求です。通常のパッチ版が新しいだけで脆弱性ありとは判定しません。

Node/Docker/npmは開発・ビルド環境です。本番のS3/CloudFrontでNodeを実行しているわけではありません。Grypeと各advisory DBの収録範囲・更新速度による見逃し、検出項目の重複、実際には利用しない機能の検出は残ります。件数はnpmでは該当パッケージ数、Grypeでは一致した項目数、Nodeでは公式項目数で、単純な合算による比較はできません。脆弱性の有無を完全に保証するものではありません。

## 公開する内容と成否

ログとActionsサマリーには対象区分、重大度別件数、更新・要確認シグナル数、チェックの完了/失敗（失敗時は固定の処理段階だけ）を表示します。依存名、CVE、説明、修正版、ツールの生出力は掲載しません。Issue・SARIF・artifactの作成、外部メール送信は行いません。GitHub自身の実行失敗通知は、利用者のGitHub通知設定に従います。

- 終了コード0：全検査が完了し、ブロック対象なし。
- 終了コード1：high/critical、重大度不明、Nodeの更新・要確認シグナルを検出。
- 終了コード2：取得・解析・イメージ構築・スキャナーなどの監視処理が失敗。検査未完了を「問題なし」と扱いません。

ツールのstdout/stderrと検査データは、権限を制限したrunner一時領域だけに保存し、処理終了時に削除します。スキャナーにはイメージアーカイブだけを渡し、認証情報やDockerソケットは渡しません。スキャナーのイメージはdigestで固定し、DBは毎回更新を確認します。48時間を超える古いDBの使用は失敗として扱います。

監視workflowに必要なのはリポジトリ読み取り権限だけです。AWS認証、本番デプロイ権限、依存の自動修正・公開はありません。checkout・runner起動など、ラッパー実行前の障害や強制終了ではサマリーを作れない場合があります。詳細が公開されることを避けるため、デバッグ用のコマンドや検査結果のアップロードをworkflowに追加しないでください。

## 保守

監視ロジックと固定スキャナー情報は `scripts/security-monitor/`、workflowは `.github/workflows/security-monitor.yml`、公開出力の回帰テストは `tests/security-monitor.test.js` にあります。スキャナー更新時は公式リリースとdigestを確認し、実検査・出力の非公開性を再検証してください。

GitHub Actions内の既知指摘は修正されるまで失敗として残ります。監視導入のために既存依存を自動更新することはありません。

参考：[Grype](https://oss.anchore.com/docs/guides/vulnerability/getting-started/)／[Node core DB](https://github.com/nodejs/security-wg/blob/main/processes/vuln_db.md)／[Node公式security RSS](https://nodejs.org/en/feed/vulnerability.xml)／[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
