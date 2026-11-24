# Masuの開発・ローカル配布

利用者向けの説明と無償利用条件は[README](../README.md)を参照してください。

## macOSで起動

このフォルダの **Masu.app** をFinderからダブルクリックします。既定ブラウザが開きます。起動中はDockのMasuから終了できます。Webファイルとサーバーを内蔵しており、起動にNode.jsやターミナルの操作は不要です。.appだけを別の場所へ移動して使えます。現在のバイナリはApple Silicon用です。

起動エラーはダイアログと `~/Library/Logs/Masu-launcher.log` に表示します。ポート49831を使用します。別のアプリがこのポートを使用している場合は、衝突をダイアログで知らせます。

### 同じWi-FiのiPhoneから使う

MacでMasuを起動すると、LANアドレスを検出してブラウザを開きます。Macと同じWi-Fiに接続したiPhoneのSafariで、そのURLを開きます。Masuのアプリメニューから「iPhone用アドレスを表示」「iPhone用アドレスをコピー」を選べます。Macを起動し、Masuを動かしている間に利用できます。接続先のネットワークやIPが変わったら、Masuを起動し直してアドレスを確認してください。

保存記録はブラウザ・端末・アドレスごとに保持します。以前の127.0.0.1で使っていた記録は「以前のローカルアドレスで開く」から利用できます。端末間の学習記録の同期はありません。

待受は127.0.0.1と、MacのLAN用プライベートIPv4アドレスに限定します。必要に応じ、macOSでMasuのローカルネットワーク利用を許可してください。

## 使い方

1. 演算、難しさ、問題数を選んで練習を開始します。詳細設定で桁数、3数の加算、小数、余りを選べます。
2. 強調されたマスに数字を入力します。ナビONでは入力後に自動移動します。
3. 「確認」で採点し、必要な修正を行って次の問題へ進みます。
4. 結果から自分の筆算と正しい筆算を比較し、復習できます。

設定、途中の練習、直近30セッション・最大100問をブラウザ内に保存します。ブラウザや公開先が変わると保存場所も変わります。設定から削除できます。

## 開発・検証

Node.js 22.17以上とnpmを使用します。macOS用の再ビルドにはXcode Command Line Toolsが必要です。

```sh
npm ci --ignore-scripts
npm run dev
npm run lint
npm test
npm run build
npm run bundle
npm run test:e2e
```

LAN用の検証は `MASU_LAN_URL=http://MacのLANアドレス:49831/ npm run test:lan` で実行できます。

E2EはGoogle Chromeと起動中のMasu.appを使用し、一時ブラウザで実行します。通常利用の保存記録には触れません。

`npm run bundle` は静的ページ、第三者通知、Web成果物、署名した.appを更新します。ソース変更後は.appを終了してから再ビルドし、起動し直してください。

## アイコン

`artwork/masu.svg` が編集用の元データです。`artwork/Masu.icns` と1024px PNGを生成し、ルートフォルダへ再適用できます。

```sh
bash scripts/icon.sh
npm run bundle
```

フォルダアイコンはmacOSのNSWorkspace APIで設定し、FinderInfoとIconリソースで保持します。

## Web配信

`dist/` を静的配信できます。相対baseとハッシュ遷移を使用しています。広告・外部解析の導入、広告アカウント登録、公開先へのデプロイは運営条件の確定後に行います。公開版の運営表示はkeetane、サポート窓口は nobodyknowsxx@gmail.com です。不具合の公開報告には公開リポジトリのGitHub Issuesも利用できます。

- [設計指示書](../APP_DESIGN.md)
- [権利・公開方針](../LICENSE_AND_RELEASE.md)
- [実施した検証と制約](QA_REPORT.md)
- [第三者通知](../THIRD_PARTY_NOTICES.md)

独自部分には[Masu 無償利用ライセンス](../LICENSE)を適用します。第三者コードは各ライセンスのままです。開発用依存一式は配布しません。

## GitHub Pages用のビルド

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run test:licenses
npm run test:publication
npm run test:i18n
```

`npm run build`は無償利用条件・第三者通知・静的ポリシーページを先に生成し、型チェックとViteビルドを実行します。`dist/`のみを配信します。`public/`やリポジトリ直下をそのまま配信しません。baseは相対パス、画面遷移はハッシュ方式です。プロジェクト名のサブパスでも動作することを公開準備試験で確認します。

`dist/LICENSE.txt`、`dist/THIRD_PARTY_NOTICES.txt`、`dist/licenses/`を削除せず同梱してください。`dist/licenses/bundle-audit.json`は実際の外部モジュールとlockfileのハッシュを記録します。未確認の実行時依存、版・ライセンス本文の変更、ビルドへの未確認モジュールの混入はビルドを失敗させます。依存を更新するときは`scripts/license-policy.mjs`の版と本文ハッシュを確認し直します。

`docs/dependency-licenses.csv`は全lockfile項目の台帳です。OS固有でインストールされていない任意依存や、ライセンス本文のない開発用依存は確認範囲を明記します。`node_modules/`、開発ツール本体、旧アプリを配布対象へ追加しないでください。

日本語・英語のUI文言は`src/i18n.ts`、React側の言語状態は`src/Language.tsx`で管理します。初期値は日本語で、`masu:v1:language`に選択を保存します。静的案内ページは`scripts/pages.mjs`と`scripts/english-pages.mjs`から生成し、`public/language.js`で同じ選択を引き継ぎます。表示言語を変えても筆算エンジンや保存データの手順は変更しません。英語の参考訳・通知テキストと国旗SVGもdistへ同梱してください。

公開先は https://keetane.github.io/Masu/ 、ソースは https://github.com/keetane/Masu です。mainへのpushまたは手動実行で、.github/workflows/pages.ymlが検証・ビルド後にdistのみをPagesへ公開します。ビルドとデプロイを分離し、公開権限はデプロイジョブだけに付けています。Actionは公式の固定コミットを使用します。広告は有効化していません。
