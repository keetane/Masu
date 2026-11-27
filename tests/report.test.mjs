import test from "node:test";
import assert from "node:assert/strict";
import {
  screenshotError,
  screenshotLimit,
  screenshotName,
  reportBody,
  reportIssueUrl,
  supportUrl,
} from "../src/report.ts";
test("screenshot validation rejects empty, oversized and active-content files", () => {
  for (const type of [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
  ])
    assert.equal(screenshotError({ type, size: screenshotLimit }), null);
  for (const file of [
    { type: "image/png", size: 0 },
    { type: "image/png", size: screenshotLimit + 1 },
    { type: "image/svg+xml", size: 100 },
    { type: "text/html", size: 100 },
  ])
    assert.ok(screenshotError(file));
  assert.equal(screenshotName("image/png"), "masu-bug-report.png");
  assert.equal(screenshotName("image/jpeg"), "masu-bug-report.jpg");
});
test("report includes only the selected context and optional environment", () => {
  const options = {
    language: "en",
    description: "  Digits moved 123  ",
    context: { screen: "練習", expression: "220 ÷ 6", step: "4 / 10" },
    includeProblem: false,
  };
  const plain = reportBody(options);
  assert.ok(plain.includes("Screen: Practice"));
  assert.ok(reportBody({ ...options, language: "ja" }).includes("画面: 練習"));
  assert.ok(plain.includes("Digits moved 123"));
  assert.ok(!plain.includes("220 ÷ 6"));
  assert.ok(!plain.includes("4 / 10"));
  assert.ok(!plain.includes("Environment:"));
  const full = reportBody({
    ...options,
    includeProblem: true,
    environment: "Test browser",
  });
  assert.ok(full.includes("220 ÷ 6"));
  assert.ok(full.includes("4 / 10"));
  assert.ok(full.includes("Test browser"));
  assert.ok(full.includes(supportUrl));
});
test("GitHub issue link safely preserves report punctuation, line breaks and Unicode", () => {
  const body = "a+b & x=1\n日本語 😀 ? #",
    url = new URL(reportIssueUrl(body));
  assert.equal(url.protocol, "https:");
  assert.equal(url.origin + url.pathname, supportUrl + "/new");
  assert.equal(url.searchParams.get("body"), body);
  assert.equal(url.searchParams.get("title"), "Masu bug report");
  assert.doesNotThrow(() => reportIssueUrl("incomplete surrogate \ud800"));
});

test("long issue reports use copy fallback without truncation", () => {
  const body = "あ".repeat(1000);
  const url = new URL(reportIssueUrl(body));
  assert.ok(url.href.length < 7500);
  assert.equal(url.searchParams.get("body"), null);
  assert.equal(url.origin + url.pathname, supportUrl + "/new");
  assert.equal(url.searchParams.get("title"), "Masu bug report");
});
