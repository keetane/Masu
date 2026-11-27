import { useEffect, useRef, useState } from "react";
import { useI18n } from "./Language";
import {
  canShareScreenshot,
  reportBody,
  reportIssueUrl,
  screenshotError,
  screenshotLimit,
  screenshotName,
  supportUrl,
  type ReportContext,
} from "./report";
export function BugReport({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: ReportContext;
}) {
  const { language, t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null),
    previewText = useRef<HTMLTextAreaElement>(null);
  const selected = useRef(0),
    imageUrl = useRef("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [description, setDescription] = useState("");
  const [reportContext, setReportContext] = useState(context);
  const [includeProblem, setIncludeProblem] = useState(false),
    [includeEnvironment, setIncludeEnvironment] = useState(true);
  const [loading, setLoading] = useState(false),
    [sharing, setSharing] = useState(false);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (open && !dialog.current?.open) {
      setStatus("");
      if (!image && !description.trim()) setReportContext(context);
      dialog.current?.showModal();
    } else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(
    () => () => {
      selected.current++;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    },
    [],
  );
  async function choose(file?: File) {
    if (!file) return;
    const sequence = ++selected.current;
    setError("");
    setStatus("");
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = "";
    setImage(null);
    setReportContext(context);
    const invalid = screenshotError(file);
    if (invalid) {
      setLoading(false);
      setError(invalid);
      return;
    }
    setLoading(true);
    const safe = new File([file], screenshotName(file.type), {
      type: file.type,
    });
    let url = URL.createObjectURL(safe);
    try {
      const preview = new Image();
      preview.src = url;
      await preview.decode();
      let attachment = safe;
      if (safe.type !== "image/png" && safe.type !== "image/jpeg") {
        const canvas = document.createElement("canvas");
        canvas.width = preview.naturalWidth;
        canvas.height = preview.naturalHeight;
        const drawing = canvas.getContext("2d");
        if (!drawing) throw Error("Canvas unavailable");
        drawing.drawImage(preview, 0, 0);
        const png = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!png) throw Error("PNG conversion failed");
        if (png.size > screenshotLimit) {
          if (sequence === selected.current)
            setError("添付用PNGが10MBを超えます。小さな画像を選んでください。");
          URL.revokeObjectURL(url);
          return;
        }
        attachment = new File([png], screenshotName("image/png"), {
          type: "image/png",
        });
        URL.revokeObjectURL(url);
        url = URL.createObjectURL(attachment);
      }
      if (sequence !== selected.current) {
        URL.revokeObjectURL(url);
        return;
      }
      imageUrl.current = url;
      setImage({ file: attachment, url });
    } catch {
      URL.revokeObjectURL(url);
      if (sequence === selected.current)
        setError("画像を読み込めません。別のスクショを選んでください。");
    } finally {
      if (sequence === selected.current) setLoading(false);
    }
  }
  const body = reportBody({
    language,
    description,
    context: reportContext,
    includeProblem,
    environment: includeEnvironment
      ? navigator.userAgent.slice(0, 300) +
        " · " +
        window.innerWidth +
        " × " +
        window.innerHeight +
        " · " +
        language
      : undefined,
  });
  const ready = !!image && !!description.trim() && !loading && !sharing;
  async function share() {
    if (!ready || !image) return;
    setSharing(true);
    setStatus("");
    try {
      await navigator.share({
        title: "Masu bug report",
        text: body,
        files: [image.file],
      });
      setStatus(
        "共有先に渡しました。送信が完了したかは共有先で確認してください。",
      );
    } catch (err) {
      const cancelled =
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        err.name === "AbortError";
      setStatus(
        cancelled
          ? "共有をキャンセルしました。入力内容は残っています。"
          : "共有できませんでした。報告文をコピーし、GitHubでスクショを添付してください。",
      );
    } finally {
      setSharing(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setStatus("報告文をコピーしました。");
    } catch {
      previewText.current?.focus();
      previewText.current?.select();
      setStatus("報告文を選択しました。手動でコピーしてください。");
    }
  }
  return (
    <dialog
      className="bug-report"
      ref={dialog}
      aria-labelledby="bug-report-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="report-heading">
        <h2 id="bug-report-title">{t("スクショで不具合を報告")}</h2>
        <button type="button" aria-label={t("閉じる")} onClick={onClose}>
          ×
        </button>
      </div>
      <p className="report-intro">
        {t(
          "端末でスクショを撮り、下から選んでください。送る前に、個人情報が写っていないか確認してください。",
        )}
      </p>
      <p className="report-note">
        {t(
          "GitHubへのログインが必要です。投稿内容と添付画像は公開されます。個人情報は含めないでください。",
        )}
      </p>
      <label className="report-field">
        {t("スクショ（PNG・JPEGなど、10MBまで）")}
        <input
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif"
          disabled={sharing}
          onChange={(event) => {
            void choose(event.currentTarget.files?.[0]);
          }}
        />
      </label>
      {loading && <p role="status">{t("画像を確認しています…")}</p>}
      {error && (
        <p className="report-error" role="alert">
          {t(error)}
        </p>
      )}
      {image && (
        <div className="report-image">
          <img src={image.url} alt={t("選んだスクショのプレビュー")} />
          <a href={image.url} download={image.file.name}>
            {t("スクショを保存")}
          </a>
        </div>
      )}
      <label className="report-field">
        {t("起きたこと（必須）")}
        <textarea
          required
          maxLength={1000}
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setStatus("");
          }}
          placeholder={t(
            "例：割り算で次の数字の位置がずれます。操作手順も教えてください。",
          )}
        />
      </label>
      {reportContext.expression && (
        <label className="report-check">
          <input
            type="checkbox"
            checked={includeProblem}
            onChange={(event) => {
              setIncludeProblem(event.target.checked);
              setStatus("");
            }}
          />
          {t("現在の問題と入力位置を報告に含める")}
        </label>
      )}
      <label className="report-check">
        <input
          type="checkbox"
          checked={includeEnvironment}
          onChange={(event) => {
            setIncludeEnvironment(event.target.checked);
            setStatus("");
          }}
        />
        {t("ブラウザ・画面サイズ・表示言語を報告に含める")}
      </label>
      <label className="report-field">
        {t("報告文（送る前に確認）")}
        <textarea ref={previewText} readOnly rows={5} value={body} />
      </label>
      <p className="report-destination">
        {t("報告先")}:{" "}
        <a href={supportUrl} target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>
      </p>
      <div className="report-actions">
        <button type="button" disabled={!ready} onClick={() => void copy()}>
          {t("報告文をコピー")}
        </button>
        {ready ? (
          <a
            className="report-issue"
            href={reportIssueUrl(body)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("GitHubで報告する")}
          </a>
        ) : (
          <button type="button" disabled>
            {t("GitHubで報告する")}
          </button>
        )}
      </div>
      <p className="report-note">
        {t(
          "GitHubの作成画面でスクショを手動添付してください。報告文が入っていない場合は、コピーして貼り付けてください。投稿はGitHub上で確定します。",
        )}
      </p>
      {canShareScreenshot(image?.file ?? null) && (
        <>
          <button
            className="wide"
            type="button"
            disabled={!ready}
            onClick={() => void share()}
          >
            {t("スクショと報告文を共有")}
          </button>
          <p className="report-note">
            {t(
              "画像と報告文を他のアプリへ渡せます。GitHubへ投稿する場合は「GitHubで報告する」を使ってください。",
            )}
          </p>
        </>
      )}
      <p className="report-note">
        {t(
          "画像と入力内容はこの画面内だけで扱い、自動送信・保存はしません。GitHubの報告画面を開くと報告文が渡されます。",
        )}
      </p>
      {status && (
        <p className="report-status" role="status">
          {t(status)}
        </p>
      )}
    </dialog>
  );
}
