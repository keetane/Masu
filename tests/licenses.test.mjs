import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  reviewed,
  reviewedLicenses,
  sha256,
  licenseBundleAudit,
} from "../scripts/license-policy.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function fixture(change) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "masu-license-test-"));
  try {
    fs.copyFileSync("package-lock.json", path.join(root, "package-lock.json"));
    for (const item of reviewed) {
      const dir = "node_modules/" + item.name;
      fs.mkdirSync(path.join(root, dir), { recursive: true });
      for (const file of ["package.json", item.file])
        fs.copyFileSync(dir + "/" + file, path.join(root, dir, file));
    }
    change(root);
    return reviewedLicenses(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("free-use terms and metadata are consistent in source and distribution", () => {
  const own = read("LICENSE");
  assert.match(own, /Masu 無償利用ライセンス 1\.0/);
  assert.match(own, /無償で利用できます/);
  assert.match(own, /第三者ソフトウェアは本ライセンスの対象外/);
  assert.equal(
    JSON.parse(read("package.json")).license,
    "SEE LICENSE IN LICENSE",
  );
  assert.equal(
    JSON.parse(read("package-lock.json")).packages[""].license,
    "SEE LICENSE IN LICENSE",
  );
  assert.match(read("README.md"), /Masuは無償です/);
  for (const dir of ["public", "dist"]) {
    assert.equal(read(dir + "/LICENSE.txt"), own);
    assert.ok(read(dir + "/licenses/index.html").includes(escape(own)));
    assert.match(read(dir + "/terms/index.html"), /無償で利用できます/);
  }
});

test("all reviewed notices retain exact upstream copyright and permission text", () => {
  const licenses = reviewedLicenses();
  assert.equal(licenses.length, 5);
  for (const item of licenses) {
    assert.match(item.text, /Copyright/);
    assert.match(item.text, /Permission is hereby granted/);
    assert.match(item.text, /THE SOFTWARE IS PROVIDED/);
    assert.equal(sha256(item.text), item.hash);
    assert.ok(read("THIRD_PARTY_NOTICES.md").includes(item.text.trimEnd()));
    for (const dir of ["public", "dist"]) {
      assert.equal(
        read(dir + "/THIRD_PARTY_NOTICES.txt"),
        read("THIRD_PARTY_NOTICES.md"),
      );
      assert.ok(
        read(dir + "/licenses/index.html").includes(
          escape(item.text.trimEnd()),
        ),
      );
    }
  }
});

test("version changes fail until separately reviewed", () => {
  assert.throws(
    () =>
      fixture((root) => {
        const file = path.join(root, "node_modules/react/package.json");
        const info = JSON.parse(read(file));
        info.version = "99.0.0";
        fs.writeFileSync(file, JSON.stringify(info));
      }),
    /未確認の版/,
  );
});

test("changed or missing license text fails closed", () => {
  assert.throws(
    () =>
      fixture((root) =>
        fs.appendFileSync(
          path.join(root, "node_modules/react/LICENSE"),
          "changed",
        ),
      ),
    /本文が変更/,
  );
  assert.throws(
    () =>
      fixture((root) =>
        fs.unlinkSync(path.join(root, "node_modules/react/LICENSE")),
      ),
    /ENOENT/,
  );
});

test("new runtime dependencies fail until separately reviewed", () => {
  assert.throws(
    () =>
      fixture((root) => {
        const file = path.join(root, "package-lock.json");
        const lock = JSON.parse(read(file));
        lock.packages["node_modules/unknown-package"] = {
          version: "1.0.0",
          license: "MIT",
        };
        fs.writeFileSync(file, JSON.stringify(lock));
      }),
    /依存関係が変更/,
  );
});

test("actual bundled inputs reject undeclared packages and unknown virtual modules", () => {
  const audit = licenseBundleAudit();
  const context = {
    error: (message) => {
      throw Error(message);
    },
    emitFile: () => {},
  };
  for (const id of [
    process.cwd() + "/node_modules/unknown-package/index.js",
    process.cwd() + "/node_modules/unknown-package/node_modules/react/index.js",
    "\0unknown-vendor.js",
  ]) {
    assert.throws(
      () =>
        audit.generateBundle.call(
          context,
          {},
          { app: { type: "chunk", modules: { [id]: {} } } },
        ),
      /未確認/,
    );
  }
  assert.throws(
    () =>
      audit.generateBundle.call(
        context,
        {},
        {
          app: {
            type: "chunk",
            modules: {},
            imports: ["https://example.invalid/library.js"],
          },
        },
      ),
    /未確認/,
  );
});

test("built module report matches lockfile and includes no machine paths", () => {
  const report = JSON.parse(read("dist/licenses/bundle-audit.json"));
  assert.equal(
    report.lockfileSha256,
    sha256(fs.readFileSync("package-lock.json")),
  );
  for (const item of reviewed)
    assert.ok(
      report.notices.some(
        (notice) =>
          notice.name === item.name && notice.licenseSha256 === item.hash,
      ),
    );
  for (const name of ["react", "react-dom", "scheduler"])
    assert.ok(
      report.modules.some((id) => id.startsWith("node_modules/" + name + "/")),
    );
  assert.ok(report.modules.includes("vite/modulepreload-polyfill.js"));
  assert.ok(report.modules.includes("commonjsHelpers.js"));
  assert.ok(!read("dist/licenses/bundle-audit.json").includes(process.cwd()));
  assert.equal(
    read("docs/dependency-licenses.csv").trim().split("\n").length - 1,
    Object.keys(JSON.parse(read("package-lock.json")).packages).length - 1,
  );
});

test("distribution contains only the application, policies and license records", () => {
  const exact = new Set([
    "index.html",
    "masu.svg",
    "LICENSE.txt",
    "THIRD_PARTY_NOTICES.txt",
    "about/index.html",
    "privacy/index.html",
    "terms/index.html",
    "licenses/index.html",
    "licenses/bundle-audit.json",
  ]);
  function check(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) check(file);
      else {
        const relative = path.relative("dist", file).replaceAll("\\", "/");
        assert.ok(
          exact.has(relative) ||
            /^assets\/index-[\w-]+\.(js|css)$/.test(relative),
          relative,
        );
      }
    }
  }
  check("dist");
  assert.equal(read("public/masu.svg"), read("artwork/masu.svg"));
});
