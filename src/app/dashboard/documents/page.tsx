"use client";

/**
 * src/app/dashboard/documents/page.tsx
 *
 * Client Document Center
 * ──────────────────────
 * Three-step S3 presigned-URL upload flow via uploadClientFileToS3().
 *
 * Left panel  — Required-documents checklist (fetched from backend)
 * Right panel — Drag-and-drop uploader + uploaded-files list
 *
 * Document categories / buckets:
 *   tax_returns | pay_stubs | bank_statements | id_documents | other
 *
 * Delete flow:
 *   Trash icon → opens DeleteConfirmModal (state: documentToDelete)
 *   "Yes, Delete" → DELETE /api/client/documents/delete?id=<id>
 *   On success   → remove from local uploadedFiles list
 */

import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  uploadClientFileToS3,
  type ConfirmedDocument,
} from "@/lib/uploadClientFileToS3";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  { value: "tax_returns",     label: "Tax Returns" },
  { value: "pay_stubs",       label: "Pay Stubs" },
  { value: "bank_statements", label: "Bank Statements" },
  { value: "id_documents",    label: "ID Documents" },
  { value: "other",           label: "Other" },
] as const;

type CategoryValue = (typeof DOCUMENT_CATEGORIES)[number]["value"];

// ── Types ─────────────────────────────────────────────────────────────────────

type RequiredDocument = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: "required" | "uploaded" | "reviewing" | "approved";
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

type UploadedFile = ConfirmedDocument;

type JsonRecord = Record<string, unknown>;

// ── Normalization helpers ─────────────────────────────────────────────────────

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function humanize(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function stringFromRecord(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeStatus(value: unknown): RequiredDocument["status"] {
  if (typeof value !== "string") return "required";
  const n = value.trim().toLowerCase();
  if (["uploaded", "complete", "completed"].includes(n)) return "uploaded";
  if (["reviewing", "in_review", "pending_review"].includes(n)) return "reviewing";
  if (["approved", "accepted"].includes(n)) return "approved";
  return "required";
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of ["requiredDocuments", "documents", "items", "data"]) {
    const v = payload[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function normalizeRequiredDocuments(payload: unknown): RequiredDocument[] {
  return extractArray(payload)
    .map((item, i): RequiredDocument | null => {
      if (typeof item === "string") {
        const type = item.trim();
        if (!type) return null;
        return { id: type, type, title: humanize(type), description: "Upload this document so your attorney can complete the case review.", status: "required" };
      }
      if (!isRecord(item)) return null;
      const type = stringFromRecord(item, ["type", "documentType", "key", "slug", "code"]) || `document-${i + 1}`;
      const title = stringFromRecord(item, ["title", "name", "label", "displayName"]) || humanize(type);
      const description = stringFromRecord(item, ["description", "helpText", "reason"]) || "Upload this document so your attorney can complete the case review.";
      const id = stringFromRecord(item, ["id", "_id"]) || type;
      const status = item.uploaded === true ? "uploaded" : normalizeStatus(item.status);
      return { id, type, title, description, status };
    })
    .filter((d): d is RequiredDocument => d !== null);
}

function normalizeUploadedFiles(payload: unknown): UploadedFile[] {
  const arr = extractArray(payload);
  return arr.filter(isRecord).map((item) => ({
    // Spread extra fields first so our explicit safe defaults always win
    ...item,
    id:         String(item.id ?? item._id ?? ""),
    s3Key:      String(item.s3Key ?? item.key ?? ""),
    fileName:   String(item.fileName ?? item.name ?? "Unknown"),
    fileType:   String(item.fileType ?? item.mimeType ?? ""),
    fileSize:   Number(item.fileSize ?? item.size ?? 0),
    category:   String(item.category ?? "other"),
    uploadedAt: String(item.uploadedAt ?? item.createdAt ?? ""),
  }));
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  for (const key of ["message", "error"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientDocumentsPage() {
  // Required-documents state
  const [requiredDocs,  setRequiredDocs]  = useState<RequiredDocument[]>([]);
  const [loadingReq,    setLoadingReq]    = useState(true);
  const [reqError,      setReqError]      = useState("");

  // Uploaded-files state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingUploaded, setLoadingUploaded] = useState(true);

  // Delete confirmation modal state
  const [documentToDelete, setDocumentToDelete] = useState<UploadedFile | null>(null);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [deleteError,      setDeleteError]      = useState("");

  // Upload form state
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>("tax_returns");
  const [pendingFile,      setPendingFile]       = useState<File | null>(null);
  const [documentTitle,    setDocumentTitle]     = useState("");
  const [isDragging,       setIsDragging]        = useState(false);
  const [uploadStatus,     setUploadStatus]      = useState<UploadStatus>("idle");
  const [uploadProgress,   setUploadProgress]    = useState(0);
  const [uploadError,      setUploadError]       = useState("");
  const [uploadNotice,     setUploadNotice]      = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load required documents ────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    setLoadingReq(true);
    setReqError("");

    fetch("/api/client/documents/required", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})).then((p) => ({ ok: r.ok, p })))
      .then(({ ok, p }) => {
        if (!active) return;
        if (!ok) throw new Error(getErrorMessage(p, "Unable to load required documents."));
        setRequiredDocs(normalizeRequiredDocuments(p));
      })
      .catch((e) => { if (active) setReqError(e instanceof Error ? e.message : "Unable to load required documents."); })
      .finally(() => { if (active) setLoadingReq(false); });

    return () => { active = false; };
  }, []);

  // ── Load previously uploaded documents ────────────────────────────────────

  const fetchUploadedFiles = useCallback(async () => {
    setLoadingUploaded(true);
    try {
      const res = await fetch("/api/client/documents/list", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setUploadedFiles(normalizeUploadedFiles(payload));
      } else {
        // Non-ok (404, 401, 502, etc.) — clear the list rather than leaving stale data
        setUploadedFiles([]);
      }
    } catch {
      // Network failure — non-fatal, clear list to avoid stale state
      setUploadedFiles([]);
    } finally {
      setLoadingUploaded(false);
    }
  }, []);

  useEffect(() => { fetchUploadedFiles(); }, [fetchUploadedFiles]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const categoryLabel = useMemo(
    () => DOCUMENT_CATEGORIES.find((c) => c.value === selectedCategory)?.label ?? "Document",
    [selectedCategory]
  );

  // ── File selection helpers ─────────────────────────────────────────────────

  function selectFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    setUploadNotice("");
    setUploadStatus("idle");
    setUploadProgress(0);
    setPendingFile(file);
    // Auto-derive a title from the filename as a convenience default
    if (!documentTitle) {
      setDocumentTitle(
        file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()
      );
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    selectFile(e.target.files?.[0]);
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    selectFile(e.dataTransfer.files[0]);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!documentToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(
        `/api/client/documents/delete?id=${encodeURIComponent(documentToDelete.id)}`,
        { method: "DELETE", cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = getErrorMessage(payload, "Failed to delete the document. Please try again.");
        setDeleteError(msg);
        return;
      }

      // Optimistically remove from list
      setUploadedFiles((prev) => prev.filter((f) => f.id !== documentToDelete.id));
      setDocumentToDelete(null);
    } catch {
      setDeleteError("Network error. Please check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDeleteCancel() {
    if (isDeleting) return;
    setDocumentToDelete(null);
    setDeleteError("");
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFile || !documentTitle.trim() || uploadStatus === "uploading") return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError("");
    setUploadNotice("");

    try {
      const doc = await uploadClientFileToS3(pendingFile, selectedCategory, {
        title: documentTitle.trim(),
        onProgress: (pct) => setUploadProgress(pct),
      });

      setUploadStatus("success");
      setUploadNotice(`"${documentTitle.trim()}" uploaded successfully to ${categoryLabel}.`);
      setPendingFile(null);
      setDocumentTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Prepend the newly confirmed document into the local list
      setUploadedFiles((prev) => [doc, ...prev]);
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {documentToDelete && (
        <DeleteConfirmModal
          file={documentToDelete}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy leading-[1.1]">
          Document Center
        </h1>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed max-w-[720px]">
          Upload the documents requested for your case. Files are stored securely and shared only with your attorney.
        </p>
      </div>

      {/* ── Status banner ─────────────────────────────────────────────────── */}
      {(uploadError || uploadNotice) && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm font-medium transition-all ${
            uploadError
              ? "border-error/20 bg-error-bg text-error"
              : "border-success/20 bg-success-bg text-success"
          }`}
        >
          {uploadError || uploadNotice}
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,440px)] gap-5 max-[960px]:grid-cols-1">

        {/* ── Left: Required documents checklist ──────────────────────────── */}
        <section className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 max-[640px]:px-4">
            <div>
              <h2 className="font-serif text-[1.0625rem] font-bold text-navy m-0">
                Required Documents
              </h2>
              <p className="mt-1 text-[0.8125rem] text-text-muted">
                Requested by your attorney for this case.
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-full bg-crimson-light px-3 py-1 text-xs font-semibold text-crimson whitespace-nowrap">
              {requiredDocs.length} requested
            </span>
          </div>

          <div className="p-6 max-[640px]:p-4">
            {loadingReq ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 rounded-md border border-border bg-bg p-4 animate-pulse">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-border shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-1/3 rounded bg-border" />
                      <div className="h-2.5 w-2/3 rounded bg-border" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reqError ? (
              <div className="rounded-md border border-error/20 bg-error-bg px-4 py-3 text-sm text-error">
                {reqError}
              </div>
            ) : requiredDocs.length === 0 ? (
              <div className="rounded-md border border-border bg-bg px-4 py-5">
                <p className="m-0 text-sm font-semibold text-text-primary">No documents requested yet.</p>
                <p className="mt-1 text-sm text-text-muted">
                  When your attorney requests documents, they will appear here.
                </p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {requiredDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex gap-3 rounded-md border border-border bg-white p-4 shadow-sm"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        doc.status === "required"
                          ? "border-warning bg-warning-bg text-warning"
                          : doc.status === "approved"
                          ? "border-success bg-success-bg text-success"
                          : "border-[#2563eb]/40 bg-[#eff4ff] text-[#2563eb]"
                      }`}
                      aria-hidden
                    >
                      {doc.status === "required" ? <ClockIcon /> : <CheckIcon />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-sm font-bold text-text-primary">{doc.title}</p>
                        <StatusBadge status={doc.status} />
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">{doc.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Right: Upload + Uploaded files ──────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Upload card */}
          <section className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-border px-6 py-5 max-[640px]:px-4">
              <h2 className="font-serif text-[1.0625rem] font-bold text-navy m-0">Upload a File</h2>
              <p className="mt-1 text-[0.8125rem] text-text-muted">
                Select a category, then drop or choose your file.
              </p>
            </div>

            <form className="flex flex-col gap-5 p-6 max-[640px]:p-4" onSubmit={handleUpload}>

              {/* Category picker */}
              <div className="form-group">
                <label className="form-label" htmlFor="docCategory">Document Category</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      id={`cat-${cat.value}`}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`rounded-lg border px-3 py-2.5 text-[0.8125rem] font-semibold text-left transition-all duration-150 ${
                        selectedCategory === cat.value
                          ? "border-crimson bg-crimson-light text-crimson shadow-sm"
                          : "border-border bg-bg text-text-muted hover:border-crimson/40 hover:text-navy"
                      }`}
                    >
                      <CategoryIcon category={cat.value} />
                      <span className="ml-1.5">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drag-and-drop zone */}
              <div className="form-group">
                <span className="form-label">File</span>
                <label
                  htmlFor="documentFile"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all duration-200 ${
                    isDragging
                      ? "border-crimson bg-crimson-light/60 scale-[1.01]"
                      : pendingFile
                      ? "border-success/50 bg-success-bg"
                      : "border-border bg-bg hover:border-crimson hover:bg-crimson-light/40"
                  }`}
                >
                  {pendingFile ? (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success">
                        <CheckCircleIcon />
                      </div>
                      <span className="text-sm font-semibold text-navy max-w-[200px] truncate">{pendingFile.name}</span>
                      <span className="text-xs text-text-muted">{formatBytes(pendingFile.size)}</span>
                      <span className="text-xs text-success font-medium">Click to change</span>
                    </>
                  ) : (
                    <>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isDragging ? "bg-crimson/10 text-crimson" : "bg-bg text-crimson"}`}>
                        <UploadIcon />
                      </div>
                      <span className="text-sm font-semibold text-navy">
                        {isDragging ? "Drop your file here" : "Drag & drop or click to select"}
                      </span>
                      <span className="text-xs text-text-muted">PDF, image, Word, or Excel accepted</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    id="documentFile"
                    className="sr-only"
                    type="file"
                    onChange={handleFileInputChange}
                    disabled={uploadStatus === "uploading"}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                  />
                </label>
              </div>

              {/* Document title — shown once a file is staged */}
              {pendingFile && (
                <div className="form-group">
                  <label className="form-label" htmlFor="documentTitle">
                    Document Title
                    <span className="ml-1 text-crimson" aria-hidden>*</span>
                  </label>
                  <input
                    id="documentTitle"
                    type="text"
                    className="form-input"
                    placeholder='e.g. “2023 W-2 for John Smith”'
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    disabled={uploadStatus === "uploading"}
                    maxLength={120}
                    autoFocus
                  />
                  <p className="mt-1.5 text-[0.75rem] text-text-muted">
                    Give this file a clear name your attorney will see.
                  </p>
                </div>
              )}

              {/* Progress bar */}
              {uploadStatus === "uploading" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="font-medium">Uploading to secure storage…</span>
                    <span className="font-semibold text-navy">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-crimson transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                id="doc-upload-btn"
                className="btn btn--primary btn--full min-h-12"
                type="submit"
                disabled={!pendingFile || !documentTitle.trim() || uploadStatus === "uploading"}
              >
                {uploadStatus === "uploading" ? (
                  <>
                    <span className="spinner" aria-hidden />
                    Uploading…
                  </>
                ) : (
                  `Upload to ${categoryLabel}`
                )}
              </button>
            </form>
          </section>

          {/* Uploaded files list */}
          <section className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 max-[640px]:px-4">
              <h2 className="font-serif text-[1rem] font-bold text-navy m-0">Uploaded Files</h2>
              <button
                onClick={fetchUploadedFiles}
                title="Refresh list"
                className="p-1.5 rounded-md text-text-muted hover:text-navy hover:bg-bg transition-colors"
              >
                <RefreshIcon />
              </button>
            </div>

            <div className="p-6 max-[640px]:p-4">
              {loadingUploaded ? (
                <div className="flex flex-col gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3 animate-pulse">
                      <div className="h-9 w-9 rounded-lg bg-border shrink-0" />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-2.5 w-2/3 rounded bg-border" />
                        <div className="h-2 w-1/3 rounded bg-border" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : uploadedFiles.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">
                  No files uploaded yet. Use the uploader above.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {uploadedFiles.map((file) => (
                    <li
                      key={file.id || file.s3Key}
                      className="flex items-center gap-3 rounded-lg border border-border bg-bg p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-border text-text-muted">
                        <FileIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-xs font-semibold text-text-primary truncate">
                          {(file as { title?: string | null }).title?.trim() || file.fileName}
                        </p>
                        {(file as { title?: string | null }).title?.trim() && (
                          <p className="m-0 mt-0.5 text-[0.7rem] text-text-muted truncate">{file.fileName}</p>
                        )}
                        <p className="m-0 mt-0.5 text-[0.7rem] text-text-muted">
                          {DOCUMENT_CATEGORIES.find((c) => c.value === file.category)?.label ?? humanize(file.category)}
                          {file.fileSize ? ` · ${formatBytes(file.fileSize)}` : ""}
                          {file.uploadedAt ? ` · ${formatDate(file.uploadedAt)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center rounded-full bg-success-bg px-2 py-0.5 text-[0.6875rem] font-semibold text-success">
                        Uploaded
                      </span>
                      {/* Trash-can — opens modal, does NOT delete immediately */}
                      <button
                        type="button"
                        id={`delete-doc-${file.id || file.s3Key}`}
                        title={`Delete ${file.fileName}`}
                        onClick={() => { setDocumentToDelete(file); setDeleteError(""); }}
                        className="shrink-0 ml-1 flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-error-bg hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50"
                        aria-label={`Delete ${file.fileName}`}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequiredDocument["status"] }) {
  const map: Record<RequiredDocument["status"], string> = {
    required:  "bg-warning-bg text-warning",
    uploaded:  "bg-success-bg text-success",
    reviewing: "bg-[#eff4ff] text-[#2563eb]",
    approved:  "bg-success-bg text-success",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${map[status]}`}>
      {humanize(status)}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ReactElement> = {
    tax_returns:     <span>📄</span>,
    pay_stubs:       <span>💰</span>,
    bank_statements: <span>🏦</span>,
    id_documents:    <span>🪪</span>,
    other:           <span>📁</span>,
  };
  return icons[category] ?? <span>📁</span>;
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────

type DeleteConfirmModalProps = {
  file: UploadedFile;
  isDeleting: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirmModal({ file, isDeleting, error, onConfirm, onCancel }: DeleteConfirmModalProps) {
  // Close on backdrop click (but not while deleting)
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isDeleting) onCancel();
  }

  // Trap Escape key
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDeleting, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px] transition-opacity" aria-hidden />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-border animate-fade-in">

        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-6 py-5">
          {/* Warning icon circle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-bg text-error" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="delete-modal-title" className="font-serif text-[1.0625rem] font-bold text-navy m-0">
              Delete Document?
            </h2>
            <p className="mt-1 text-[0.8125rem] text-text-muted">
              This action is permanent and cannot be undone.
            </p>
          </div>
          {/* Close × */}
          {!isDeleting && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="shrink-0 -mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p id="delete-modal-desc" className="text-sm leading-relaxed text-text-secondary">
            Are you absolutely sure you want to delete{" "}
            <span className="font-semibold text-text-primary break-all">"{file.fileName}"</span>?
            {" "}This will permanently destroy the file in Amazon S3 and remove the database record.{" "}
            <span className="font-semibold text-error">This action cannot be undone.</span>
          </p>

          {/* Inline error */}
          {error && (
            <div role="alert" className="mt-4 rounded-md border border-error/20 bg-error-bg px-4 py-2.5 text-sm text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            id="delete-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg hover:text-navy disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
          >
            Cancel
          </button>
          <button
            id="delete-modal-confirm"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#a93226] active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50"
          >
            {isDeleting ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  aria-hidden
                />
                Deleting…
              </>
            ) : (
              <>
                <TrashIcon />
                Yes, Delete Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
