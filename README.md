# Masu

四則演算の筆算を、マスへの数字入力とナビゲーションで練習するWebアプリです。

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

`dist/` を静的配信できます。相対baseとハッシュ遷移を使用しています。広告・外部解析の導入、広告アカウント登録、公開先へのデプロイは運営条件の確定後に行います。公開用の運営者・問い合わせ先は実際の運営情報に更新してください。

- [設計指示書](APP_DESIGN.md)
- [権利・公開方針](LICENSE_AND_RELEASE.md)
- [実施した検証と制約](docs/QA_REPORT.md)
- [第三者通知](THIRD_PARTY_NOTICES.md)

Masuは仮称です。自作部分をOSSライセンスで再許諾する判断は保留し、第三者コードの許諾文を同梱しています。
