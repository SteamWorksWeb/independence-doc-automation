"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type RequiredDocument = {
  id: string;
  type: string;
  title: string;
  description: string;
  status: "required" | "uploaded" | "reviewing" | "approved";
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function humanizeDocumentType(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stringFromRecord(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizeStatus(value: unknown): RequiredDocument["status"] {
  if (typeof value !== "string") return "required";

  const normalized = value.trim().toLowerCase();
  if (["uploaded", "complete", "completed"].includes(normalized)) return "uploaded";
  if (["reviewing", "in_review", "pending_review"].includes(normalized)) return "reviewing";
  if (["approved", "accepted"].includes(normalized)) return "approved";

  return "required";
}

function extractDocumentArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of ["requiredDocuments", "documents", "items", "data"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeRequiredDocuments(payload: unknown): RequiredDocument[] {
  return extractDocumentArray(payload)
    .map((item, index): RequiredDocument | null => {
      if (typeof item === "string") {
        const type = item.trim();
        if (!type) return null;

        return {
          id: type,
          type,
          title: humanizeDocumentType(type),
          description: "Upload this document so your attorney can complete the case review.",
          status: "required",
        };
      }

      if (!isRecord(item)) return null;

      const type =
        stringFromRecord(item, ["type", "documentType", "key", "slug", "code"]) ||
        `document-${index + 1}`;
      const title =
        stringFromRecord(item, ["title", "name", "label", "displayName"]) ||
        humanizeDocumentType(type);
      const description =
        stringFromRecord(item, ["description", "helpText", "reason"]) ||
        "Upload this document so your attorney can complete the case review.";
      const id = stringFromRecord(item, ["id", "_id"]) || type;
      const status = item.uploaded === true ? "uploaded" : normalizeStatus(item.status);

      return { id, type, title, description, status };
    })
    .filter((document): document is RequiredDocument => document !== null);
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  for (const key of ["message", "error"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return fallback;
}

export default function ClientDocumentsPage() {
  const [documents, setDocuments] = useState<RequiredDocument[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCurrent = true;

    async function fetchRequiredDocuments() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("/api/client/documents/required", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Unable to load required documents."));
        }

        const normalizedDocuments = normalizeRequiredDocuments(payload);
        if (!isCurrent) return;

        setDocuments(normalizedDocuments);
        setSelectedDocumentType((current) => current || normalizedDocuments[0]?.type || "");
      } catch (err) {
        if (!isCurrent) return;
        setError(err instanceof Error ? err.message : "Unable to load required documents.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    fetchRequiredDocuments();

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.type === selectedDocumentType),
    [documents, selectedDocumentType]
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setNotice("");
    setError("");
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!selectedFile || !selectedDocumentType) {
      setError("Choose a document type and select a file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("documentType", selectedDocumentType);

    setIsUploading(true);
    try {
      const response = await fetch("/api/client/documents/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Upload failed. Please try again."));
      }

      setNotice(`${selectedDocument?.title ?? "Document"} uploaded successfully.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      window.alert("Document uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy leading-[1.1]">
          Document Upload Hub
        </h1>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed max-w-[720px]">
          Review the documents requested for your case and upload each file to your secure portal.
        </p>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-md border px-4 py-3 text-sm font-medium ${
            error
              ? "border-error/20 bg-error-bg text-error"
              : "border-success/20 bg-success-bg text-success"
          }`}
          role="status"
        >
          {error || notice}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-5 max-[900px]:grid-cols-1">
        <section className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 max-[640px]:px-4">
            <div>
              <h2 className="font-serif text-[1.0625rem] font-bold text-navy m-0">
                Required Documents
              </h2>
              <p className="mt-1 text-[0.8125rem] text-text-muted">
                This checklist updates based on your intake information.
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-full bg-crimson-light px-3 py-1 text-xs font-semibold text-crimson whitespace-nowrap">
              {documents.length} requested
            </span>
          </div>

          <div className="p-6 max-[640px]:p-4">
            {isLoading ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-bg px-4 py-5 text-sm text-text-muted">
                <span className="spinner spinner--dark" aria-hidden />
                Loading required documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-md border border-border bg-bg px-4 py-5">
                <p className="m-0 text-sm font-semibold text-text-primary">No documents requested yet.</p>
                <p className="mt-1 text-sm text-text-muted">
                  When your attorney requests documents, they will appear here.
                </p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex gap-3 rounded-md border border-border bg-white p-4 shadow-sm"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        document.status === "required"
                          ? "border-warning bg-warning-bg text-warning"
                          : "border-success bg-success-bg text-success"
                      }`}
                      aria-hidden
                    >
                      {document.status === "required" ? <ClockIcon /> : <CheckIcon />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-sm font-bold text-text-primary">{document.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${
                            document.status === "required"
                              ? "bg-warning-bg text-warning"
                              : "bg-success-bg text-success"
                          }`}
                        >
                          {humanizeDocumentType(document.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">{document.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-border px-6 py-5 max-[640px]:px-4">
            <h2 className="font-serif text-[1.0625rem] font-bold text-navy m-0">Upload a File</h2>
            <p className="mt-1 text-[0.8125rem] text-text-muted">
              Attach the file to the matching request.
            </p>
          </div>

          <form className="flex flex-col gap-5 p-6 max-[640px]:p-4" onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label" htmlFor="documentType">
                Document Type
              </label>
              <select
                id="documentType"
                className="form-input"
                value={selectedDocumentType}
                onChange={(event) => setSelectedDocumentType(event.target.value)}
                disabled={isLoading || documents.length === 0 || isUploading}
              >
                {documents.length === 0 ? (
                  <option value="">No requested documents</option>
                ) : (
                  documents.map((document) => (
                    <option key={document.id} value={document.type}>
                      {document.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <span className="form-label">File</span>
              <label
                className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-bg px-4 py-6 text-center transition-colors hover:border-crimson hover:bg-crimson-light/40"
                htmlFor="documentFile"
              >
                <UploadIcon />
                <span className="text-sm font-semibold text-navy">
                  {selectedFile ? selectedFile.name : "Select File"}
                </span>
                <span className="text-xs text-text-muted">
                  PDF, image, or document files are accepted.
                </span>
              </label>
              <input
                ref={fileInputRef}
                id="documentFile"
                className="sr-only"
                type="file"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>

            <button
              className="btn btn--primary btn--full min-h-12"
              type="submit"
              disabled={!selectedDocumentType || !selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="spinner" aria-hidden />
                  Uploading
                </>
              ) : (
                "Upload"
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="text-crimson" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
