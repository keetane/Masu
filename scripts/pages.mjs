import fs from "node:fs";
const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const rows = ["package,version,usage,license,shipped,source"];
const notices = [];
for (const [key, info] of Object.entries(lock.packages)) {
  if (!key) continue;
  const name = key.split("node_modules/").pop(),
    shipped = !info.dev;
  rows.push(
    [
      name,
      info.version,
      shipped ? "runtime" : "development",
      info.license || "inspect",
      shipped,
      info.resolved || "",
    ].join(","),
  );
  if (shipped)
    notices.push(
      name +
        " " +
        info.version +
        "\n" +
        fs.readFileSync(key + "/LICENSE", "utf8"),
    );
}
fs.writeFileSync("docs/dependency-licenses.csv", rows.join("\n") + "\n");
fs.writeFileSync("THIRD_PARTY_NOTICES.md", notices.join("\n\n"));
const pages = {
  about: [
    "使い方・運営",
    "Masuは四則演算の筆算練習帳です。演算と難しさを選び、枠で示されたマスに数字を入れてください。「確認」で採点し、結果から同じ問題を復習できます。",
    "端末版に関するお問い合わせは、このアプリを配布した方へお寄せください。",
  ],
  privacy: [
    "プライバシー・外部送信",
    "設定、途中の回答、直近30回・最大100問の結果をこのブラウザに保存します。設定から削除できます。",
    "学習記録のサーバー送信、広告、アクセス解析はありません。Web公開版の配信元には、ページ取得のためIPアドレスなどの接続情報が届きます。macOS版はこのMac内でページを配信します。",
  ],
  terms: [
    "利用規約",
    "個人・家庭・授業で筆算の練習に利用できます。学習記録はブラウザのサイトデータを消去すると失われます。",
    "自作部分の権利は各権利者に帰属します。同梱の第三者ソフトウェアには各ライセンスが適用されます。",
  ],
  licenses: [
    "第三者ライセンス",
    "盤面と格子のアイコンはMasu用に新規制作しています。フォントは端末のものを使用します。",
    ...notices,
  ],
};
for (const [slug, [title, ...body]] of Object.entries(pages)) {
  fs.mkdirSync("public/" + slug, { recursive: true });
  fs.writeFileSync(
    "public/" + slug + "/index.html",
    '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      title +
      ' | Masu</title><style>body{font:16px/1.8 system-ui;background:#f8f7ef;color:#194c40;max-width:48rem;margin:3rem auto;padding:1rem}p{white-space:pre-wrap;overflow-wrap:anywhere}a{color:inherit}</style><main><a href="../index.html">← Masu ホーム</a><h1>' +
      title +
      "</h1>" +
      body.map((t) => "<p>" + esc(t) + "</p>").join("") +
      "</main></html>",
  );
}
