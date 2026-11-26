import { translate, type Language } from "./i18n.ts";
export const supportEmail = "nobodyknowsxx@gmail.com";
export const screenshotLimit = 10 * 1024 * 1024;
export type ReportContext = {
  screen: string;
  expression?: string;
  step?: string;
};
export function screenshotError(
  file: Pick<File, "size" | "type">,
): string | null {
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
    ].includes(file.type)
  )
    return "PNG・JPEG・WebP・AVIF・HEIC・HEIFの画像を選んでください。";
  if (!file.size || file.size > screenshotLimit)
    return "画像は10MB以下の空でないファイルを選んでください。";
  return null;
}
export function screenshotName(type: string): string {
  return (
    "masu-bug-report." +
    ({
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/heic": "heic",
      "image/heif": "heif",
    }[type] ?? "png")
  );
}
export function reportBody(options: {
  language: Language;
  description: string;
  context: ReportContext;
  includeProblem: boolean;
  environment?: string;
}): string {
  const t = (text: string) => translate(text, options.language);
  const lines = [
    "Masu — " + t("不具合報告"),
    t("送信先") + ": " + supportEmail,
    "",
    t("起きたこと") + ":",
    options.description.trim(),
    "",
    t("画面") + ": " + t(options.context.screen),
  ];
  if (options.includeProblem && options.context.expression) {
    lines.push(t("問題") + ": " + options.context.expression);
    if (options.context.step)
      lines.push(t("入力位置") + ": " + options.context.step);
  }
  if (options.environment)
    lines.push(t("動作環境") + ": " + options.environment);
  lines.push("", "https://keetane.github.io/Masu/");
  return lines.join("\n");
}
export function reportMailto(body: string): string {
  const query = new URLSearchParams({ subject: "Masu bug report", body })
    .toString()
    .replaceAll("+", "%20");
  return "mailto:" + supportEmail + "?" + query;
}
export function canShareScreenshot(file: File | null): boolean {
  try {
    return (
      !!file &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}
