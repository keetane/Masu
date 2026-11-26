import { useEffect, useRef, useState } from "react";
import { useI18n } from "./Language";
import {
  canShareScreenshot,
  reportBody,
  reportMailto,
  screenshotError,
  screenshotName,
  supportEmail,
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
    const url = URL.createObjectURL(safe);
    try {
      const preview = new Image();
      preview.src = url;
      await preview.decode();
      if (sequence !== selected.current) {
        URL.revokeObjectURL(url);
        return;
      }
      imageUrl.current = url;
      setImage({ file: safe, url });
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
          : "共有できませんでした。報告文をコピーし、メールにスクショを添付してください。",
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
        {t("送信先")}: <a href={"mailto:" + supportEmail}>{supportEmail}</a>
      </p>
      {canShareScreenshot(image?.file ?? null) && (
        <>
          <button
            className="primary wide"
            type="button"
            disabled={!ready}
            onClick={() => void share()}
          >
            {t("スクショと報告文を共有")}
          </button>
          <p className="report-note">
            {t(
              "共有先でメールを選び、上の宛先へ送ってください。共有先によっては報告文の貼り付けも必要です。",
            )}
          </p>
        </>
      )}
      <div className="report-actions">
        <button type="button" disabled={!ready} onClick={() => void copy()}>
          {t("報告文をコピー")}
        </button>
        {ready ? (
          <a className="report-mail" href={reportMailto(body)}>
            {t("報告メールを開く")}
          </a>
        ) : (
          <button type="button" disabled>
            {t("報告メールを開く")}
          </button>
        )}
      </div>
      <p className="report-note">
        {t(
          "メール画面でスクショを添付してください。メールリンクには画像を自動添付できません。メールが開かない場合は、報告文をコピーして上の宛先へ送ってください。",
        )}
      </p>
      <p className="report-note">
        {t(
          "画像と入力内容はこの画面内だけで扱い、自動送信・保存はしません。送信はメールや共有先で確定してください。",
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
