import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");
// Versions and exact license texts reviewed for the distributed web application.
// Dependency updates require an explicit review here, not automatic approval.
export const reviewed = [
  {
    name: "react",
    version: "19.2.7",
    scope: "runtime",
    file: "LICENSE",
    hash: "da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93",
  },
  {
    name: "react-dom",
    version: "19.2.7",
    scope: "runtime",
    file: "LICENSE",
    hash: "da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93",
  },
  {
    name: "scheduler",
    version: "0.27.0",
    scope: "runtime",
    file: "LICENSE",
    hash: "da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93",
  },
  {
    name: "vite",
    version: "7.3.8",
    scope: "generated helper",
    file: "LICENSE.md",
    hash: "e373c2e74cd342b9e74d0b8813a8fddf3c9788515669a79c2ac238195673d38b",
  },
  {
    name: "rollup",
    version: "4.68.8",
    scope: "generated helper",
    file: "LICENSE.md",
    hash: "f131ce22896793f8d57caeab63e49393041940162c92866c8caac49a21e560a2",
  },
];

export function reviewedLicenses(root = process.cwd()) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
  );
  const runtime = Object.entries(lock.packages)
    .filter(([key, info]) => key && !info.dev)
    .map(([key]) => key);
  const expected = reviewed
    .filter((item) => item.scope === "runtime")
    .map((item) => "node_modules/" + item.name);
  if (JSON.stringify(runtime.sort()) !== JSON.stringify(expected.sort()))
    throw Error(
      "配布する依存関係が変更されています。ライセンス確認が必要です。",
    );
  return reviewed.map((item) => {
    const dir = path.join(root, "node_modules", item.name);
    const installed = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf8"),
    );
    const pinned = lock.packages["node_modules/" + item.name];
    if (
      installed.version !== item.version ||
      pinned?.version !== item.version ||
      installed.license !== "MIT" ||
      pinned.license !== "MIT"
    )
      throw Error(item.name + ": 未確認の版またはライセンスです。");
    const original = fs.readFileSync(path.join(dir, item.file), "utf8");
    const text =
      item.scope === "runtime"
        ? original
        : original.split("# Licenses of bundled dependencies")[0].trim() + "\n";
    if (sha256(text) !== item.hash)
      throw Error(item.name + ": ライセンス本文が変更されています。");
    return {
      ...item,
      text,
      source:
        "https://www.npmjs.com/package/" + item.name + "/v/" + item.version,
    };
  });
}

// Check actual Rollup module inputs as well as package-lock metadata.
export function licenseBundleAudit() {
  return {
    name: "masu-license-audit",
    apply: "build",
    generateBundle(_options, bundle) {
      const licenses = reviewedLicenses();
      const modules = new Set();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const imported of [
          ...(output.imports ?? []),
          ...(output.dynamicImports ?? []),
        ]) {
          if (!Object.hasOwn(bundle, imported))
            this.error("出所未確認の外部インポート: " + imported);
        }
        for (const id of Object.keys(output.modules)) {
          const clean = id.replaceAll("\0", "").replaceAll("\\", "/");
          const match = clean.match(
            /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g,
          );
          if (match) {
            const name = match.at(-1).replace(/^\/?node_modules\//, "");
            const relative = clean.startsWith(
              process.cwd().replaceAll("\\", "/") + "/",
            )
              ? clean.slice(process.cwd().length + 1)
              : clean;
            if (
              !licenses.some((item) => item.name === name) ||
              match.length !== 1 ||
              !relative.startsWith("node_modules/" + name + "/")
            )
              this.error("未確認の依存が配布物に含まれています: " + name);
            modules.add(relative);
          } else if (
            clean === "vite/modulepreload-polyfill.js" ||
            clean === "commonjsHelpers.js"
          ) {
            modules.add(clean);
          } else if (
            !clean.startsWith(process.cwd().replaceAll("\\", "/") + "/")
          ) {
            this.error("出所未確認の生成モジュール: " + clean);
          }
        }
      }
      this.emitFile({
        type: "asset",
        fileName: "licenses/bundle-audit.json",
        source:
          JSON.stringify(
            {
              lockfileSha256: sha256(fs.readFileSync("package-lock.json")),
              modules: [...modules].sort(),
              notices: licenses.map(({ name, version, scope, hash }) => ({
                name,
                version,
                scope,
                license: "MIT",
                licenseSha256: hash,
              })),
            },
            null,
            2,
          ) + "\n",
      });
    },
  };
}
