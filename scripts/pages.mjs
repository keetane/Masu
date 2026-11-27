import fs from "node:fs";
import { englishPages } from "./english-pages.mjs";
import { reviewedLicenses, sha256 } from "./license-policy.mjs";
const esc = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const project = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ownLicense = fs.readFileSync("LICENSE", "utf8");
const englishLicense = fs.readFileSync("LICENSE.en", "utf8");
if (
  project.license !== "SEE LICENSE IN LICENSE" ||
  lock.packages[""].license !== project.license
)
  throw Error("アプリのライセンス情報が一致していません。");
const licenses = reviewedLicenses();
const notices = licenses.map(
  ({ name, version, scope, source, text }) =>
    `## ${name} ${version}\n\n用途: ${scope === "runtime" ? "実行時ライブラリ" : "ビルドが生成する補助コード（ツール本体は配布しない）"}\nライセンス: MIT\n配布元: ${source}\n\n${text.trimEnd()}\n`,
);
const noticeText =
  "# 第三者ソフトウェアの権利表示\n\nMasuの独自部分にはLICENSEが適用されます。以下の第三者ソフトウェアには、それぞれのMITライセンスが適用されます。本文はインストール済みの固定版から取得し、改変せずに掲載しています。\n\n" +
  notices.join("\n");
fs.writeFileSync("THIRD_PARTY_NOTICES.md", noticeText);
fs.mkdirSync("public/licenses", { recursive: true });
fs.writeFileSync("public/LICENSE.txt", ownLicense);
fs.writeFileSync("public/LICENSE.en.txt", englishLicense);
fs.writeFileSync("public/THIRD_PARTY_NOTICES.txt", noticeText);
const rows = [
  [
    "package",
    "version",
    "dependency",
    "usage",
    "license",
    "shipped",
    "lock_path",
    "source",
    "evidence",
    "evidence_sha256",
    "review",
  ],
];
for (const [key, info] of Object.entries(lock.packages)) {
  if (!key) continue;
  const name = key.split("node_modules/").pop();
  const included = licenses.find((item) => item.name === name);
  const exists = fs.existsSync(key);
  const files = exists
    ? fs
        .readdirSync(key)
        .filter(
          (file) =>
            /^(licen[cs]e|copying|notice|copyright|third.?party)/i.test(file) &&
            fs.statSync(key + "/" + file).isFile(),
        )
        .sort()
    : [];
  // Preserve the location of copyright/permission evidence embedded in source/README.
  if (!files.length && exists) {
    const embedded = {
      esrecurse: "esrecurse.js",
      imurmurhash: "README.md",
      keyv: "README.md",
      "natural-compare": "README.md",
    }[name];
    if (embedded && fs.existsSync(key + "/" + embedded)) files.push(embedded);
  }
  rows.push([
    name,
    info.version,
    Object.hasOwn(project.dependencies ?? {}, name) ||
    Object.hasOwn(project.devDependencies ?? {}, name)
      ? "direct"
      : "transitive",
    info.dev ? "development" : "runtime",
    info.license || "UNKNOWN",
    included ? included.scope : "no",
    key,
    info.resolved || "",
    files.map((file) => key + "/" + file).join(";"),
    files.map((file) => sha256(fs.readFileSync(key + "/" + file))).join(";"),
    included
      ? "reviewed-exact-license"
      : !exists
        ? "optional-platform-not-installed;not-shipped"
        : files.length
          ? "local-evidence-inventoried;not-shipped"
          : "metadata-only;not-shipped",
  ]);
}
const csv = (value) => '"' + String(value).replaceAll('"', '""') + '"';
fs.writeFileSync(
  "docs/dependency-licenses.csv",
  rows.map((row) => row.map(csv).join(",")).join("\n") + "\n",
);
const englishNotices =
  "# Third-party software notices\n\nMasu’s original components are governed by LICENSE. The components below retain their respective MIT licenses. The following copyright, permission and disclaimer text is reproduced without modification from the installed fixed versions.\n\n" +
  licenses
    .map(
      ({ name, version, scope, source, text }) =>
        `## ${name} ${version}\n\nUse: ${scope === "runtime" ? "Runtime library" : "Generated build helper (the tool itself is not distributed)"}\nLicense: MIT\nSource: ${source}\n\n${text.trimEnd()}\n`,
    )
    .join("\n");
fs.writeFileSync("public/THIRD_PARTY_NOTICES.en.txt", englishNotices);
const translatedPages = englishPages(englishLicense, englishNotices);
const pages = {
  about: [
    "使い方・運営",
    "Masuは、たし算・ひき算・かけ算・わり算の筆算を練習できる無料のWebアプリです。アカウント登録は不要です。",
    "演算、難しさ、問題数を選んで「はじめる」を押します。強調された入力先に数字を入れると、ナビONでは次の位置へ進みます。全て入力すると「採点」、採点後は同じボタンが「次へ」（最後は「結果を見る」）になります。不正解でも進め、結果の○×から見直せます。",
    "スクショでの不具合報告は上部の「報告」から行えます。スクショと状況を確認し、「GitHubで報告する」から作成画面を開いて画像を手動添付してください。ログインが必要で、投稿内容と添付画像は公開されます。",
    "個人・家庭・学校・塾で無償で利用できます。利用条件と第三者ソフトウェアの権利表示は、利用規約・ライセンスのページで確認できます。",
    "運営：keetane（公開リポジトリの所有者）。お問い合わせ・不具合報告はGitHub Issuesで受け付けます。GitHubへのログインが必要です。投稿内容と添付画像は公開されるため、学習履歴や個人情報を含めないでください。",
  ],
  privacy: [
    "プライバシー・外部送信",
    "設定、途中の回答、直近30回・最大100問の結果を、この端末のブラウザ内（localStorage）に保存します。表示言語の選択もこのブラウザ内に保存します。名前・メールアドレスの入力やアカウント登録は不要です。設定から保存内容を削除できます。端末・ブラウザ・公開先が変わると保存場所も変わり、端末間では同期しません。",
    "学習記録を自動でサーバーへ送信する機能、広告、アクセス解析、外部フォント・外部画像の読み込みはありません。アプリ自身は広告・解析用Cookieを使用しません。",
    "GitHub Pages等のWeb配信元は、ページ取得の際にIPアドレスやブラウザ等の接続情報を処理する場合があります。配信事業者のプライバシー方針も確認してください。macOS版はMac上でページを配信し、同じWi-Fiの端末から接続する場合も学習記録は各端末のブラウザ内に保存します。",
    "不具合報告では、自分で選んだスクショ・記入内容と、報告文に表示される情報を確認できます。問題と入力位置の追加は任意です。ブラウザ・画面サイズ・表示言語も外せます。画像と報告文は自動送信・保存せず、学習履歴をまとめて送ることもありません。GitHubの報告画面を開くと、長すぎる場合を除き報告文がURL経由でGitHubへ渡されます。画像はGitHub上で手動添付します。投稿内容と添付画像は公開され、添付画像は投稿の確定前にもアップロードされます。ログインにはGitHubのアカウントが必要です。任意の共有操作では選択したアプリへ画像と報告文を渡せます。外部へ渡す前に内容を確認してください。",
    "広告や解析を導入する際には、送信先・情報・目的・必要な選択方法等を改めて表示します。現在の版では広告や解析のスクリプトを読み込みません。",
  ],
  terms: [
    "利用規約",
    "Masuの利用料は無料です。個人・家庭・学校・塾などで筆算の学習・指導に無償で利用できます。有料授業の学習用ツールとしての利用も可能です。通信費・端末費用は利用者の負担です。",
    "Masuの独自部分には「Masu 無償利用ライセンス 1.0」が適用されます。これはソースコード・素材の改変再配布や販売を一律に許可するOSSライセンスではありません。詳しい条件はライセンスページの全文を確認してください。第三者ソフトウェアには各ライセンスが適用されます。",
    "学習記録はブラウザ内に保存され、サイトデータの削除等で失われます。計算結果・採点の正確性、継続提供、データ保存を保証しません。適用法令で認められる範囲で責任を制限しますが、故意・重過失による責任等、法令上制限できない責任を免除するものではありません。",
  ],
  licenses: [
    "ライセンス・無償利用条件",
    "Masuは無償で利用できます。独自部分の利用条件と、第三者ソフトウェアの許諾条件を以下に掲載します。盤面・アイコンは本プロジェクト用の幾何図形で制作し、旧アプリのアイコンを継承していません。フォントは端末のものを使い、フォントファイルを配布しません。",
    ownLicense,
    noticeText,
  ],
};
for (const [slug, [title, ...body]] of Object.entries(pages)) {
  if (slug === "privacy" || slug === "terms")
    fs.writeFileSync(
      "docs/" + slug.toUpperCase() + ".md",
      "# " +
        title +
        "\n\n" +
        body.join("\n\n") +
        "\n\n[README](../README.md) ／ [無償利用ライセンス](../LICENSE)\n",
    );
  fs.mkdirSync("public/" + slug, { recursive: true });
  const render = (language, content) => {
    const [heading, ...paragraphs] = content;
    const en = language === "en";
    const links = en
      ? ["← Masu Home", "Help", "Terms", "Privacy", "Licenses"]
      : ["← Masu ホーム", "使い方", "利用規約", "プライバシー", "ライセンス"];
    const targets = [
      "index.html",
      "about/index.html",
      "terms/index.html",
      "privacy/index.html",
      "licenses/index.html",
    ];
    return (
      '<section data-language="' +
      language +
      '" data-title="' +
      esc(heading) +
      '"><nav>' +
      links
        .map(
          (name, index) =>
            '<a href="../' + targets[index] + '">' + esc(name) + "</a>",
        )
        .join("") +
      "</nav><h1>" +
      esc(heading) +
      "</h1>" +
      (slug === "about"
        ? "<p>" +
          '<a href="https://keetane.github.io/Masu/">' +
          (en ? "Open Masu" : "Webアプリを開く") +
          '</a> ／ <a href="https://github.com/keetane/Masu">' +
          (en ? "Repository" : "公開リポジトリ") +
          '</a> ／ <a href="https://github.com/keetane/Masu/issues">' +
          (en ? "Contact (GitHub Issues)" : "お問い合わせ（GitHub Issues）") +
          "</a></p>"
        : "") +
      (slug === "licenses"
        ? '<p><a href="../LICENSE' +
          (en ? ".en" : "") +
          '.txt">' +
          (en
            ? "Full free use license (text)"
            : "無償利用ライセンス全文（テキスト）") +
          '</a> ／ <a href="../THIRD_PARTY_NOTICES' +
          (en ? ".en" : "") +
          '.txt">' +
          (en
            ? "Full third-party notices (text)"
            : "第三者の権利表示全文（テキスト）") +
          "</a></p>"
        : "") +
      paragraphs.map((text) => "<p>" + esc(text) + "</p>").join("") +
      "</section>"
    );
  };
  fs.writeFileSync(
    "public/" + slug + "/index.html",
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      esc(title) +
      ' | Masu</title><style>body{font:16px/1.8 system-ui;background:#f8f7ef;color:#194c40;max-width:48rem;margin:2rem auto;padding:1rem}h1{font-size:clamp(1.4rem,5vw,2rem);line-height:1.5;text-wrap:balance}p{white-space:pre-wrap;overflow-wrap:anywhere}a{color:inherit}nav{display:flex;flex-wrap:wrap;gap:1rem}[data-language]{display:none}html[lang="ja"] [data-language="ja"],html[lang="en"] [data-language="en"]{display:block}.language-switch{display:flex;justify-content:flex-end;gap:4px;margin-bottom:1rem}.language-switch button{display:grid;place-items:center;width:44px;min-height:44px;border:1px solid #d7d9cc;border-radius:8px;background:transparent;cursor:pointer}.language-switch [aria-pressed="true"]{background:#e5ecdf;border-color:#638371}.language-switch img{border:1px solid #b6bfb2;border-radius:2px}.language-switch button:focus-visible{outline:3px solid #bd7621;outline-offset:2px}</style><script src="../language.js"></script></head><body><main><div class="language-switch" role="group" aria-label="言語"><button type="button" data-set-language="ja" aria-label="日本語" title="日本語" aria-pressed="true"><img src="../flag-ja.svg" alt="" width="30" height="20"></button><button type="button" data-set-language="en" aria-label="English" title="English" aria-pressed="false"><img src="../flag-en.svg?v=us" alt="" width="30" height="20"></button></div>' +
      render("ja", [title, ...body]) +
      render("en", translatedPages[slug]) +
      "</main></body></html>",
  );
}

console.log(
  "License notices generated: 3 runtime packages + Vite/Rollup generated helpers; " +
    (rows.length - 1) +
    " locked dependencies inventoried.",
);
