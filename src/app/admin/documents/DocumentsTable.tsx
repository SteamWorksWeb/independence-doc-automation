"use client";

/**
 * src/app/admin/documents/DocumentsTable.tsx
 *
 * Client Component: renders the master triage table for the global
 * documents archive. Handles text filter input (fileName / client.name)
 * and presents data in a clean, spacious Tailwind table.
 */

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { DocumentRecord } from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function uploaderLabel(role: string): { label: string; cls: string } {
  switch (role?.toLowerCase()) {
    case "lawyer":
    case "admin":
      return {
        label: "Lawyer",
        cls: "bg-navy/10 text-navy",
      };
    case "client":
    default:
      return {
        label: "Client",
        cls: "bg-emerald-50 text-emerald-700",
      };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  docs: DocumentRecord[];
}

export default function DocumentsTable({ docs }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return docs;
    const q = query.toLowerCase();
    return docs.filter(
      (d) =>
        d.fileName?.toLowerCase().includes(q) ||
        d.client?.name?.toLowerCase().includes(q)
    );
  }, [docs, query]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Top bar: stat + search ────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-600">
          {docs.length}{" "}
          <span className="font-normal text-slate-400">
            document{docs.length !== 1 ? "s" : ""}
          </span>
          {query && filtered.length !== docs.length && (
            <span className="text-slate-400">
              {" "}
              &mdash; showing {filtered.length}
            </span>
          )}
        </p>

        {/* Search input */}
        <div className="relative w-full max-w-xs">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            id="documents-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by file name or client…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy/40 transition"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-[35%]">
                File Name
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-[22%]">
                Associated Client
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-[14%]">
                Uploaded By
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-[12%]">
                File Size
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-[17%]">
                Date Uploaded
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-16 text-sm text-slate-400"
                >
                  {docs.length === 0
                    ? "No documents have been uploaded yet."
                    : "No documents match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((doc) => {
                const uploader = uploaderLabel(doc.uploadedByRole);
                return (
                  <tr
                    key={doc.id}
                    className="group hover:bg-slate-50/80 transition-colors duration-100"
                  >
                    {/* File Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-navy/8 text-navy">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </span>
                        <span
                          className="truncate font-medium text-slate-800"
                          title={doc.fileName}
                        >
                          {doc.fileName ?? "Untitled"}
                        </span>
                      </div>
                    </td>

                    {/* Associated Client → link to case */}
                    <td className="px-5 py-3.5">
                      {doc.client?.id ? (
                        <Link
                          href={`/admin/cases/${doc.client.id}`}
                          className="font-medium text-navy hover:underline hover:text-crimson transition-colors duration-100 truncate block max-w-[180px]"
                          title={doc.client.name}
                        >
                          {doc.client.name ?? "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Uploaded By */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${uploader.cls}`}
                      >
                        {uploader.label}
                      </span>
                    </td>

                    {/* File Size */}
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">
                      {formatFileSize(doc.fileSize)}
                    </td>

                    {/* Date Uploaded */}
                    <td className="px-5 py-3.5 text-slate-500">
                      {formatDate(doc.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            Showing {filtered.length} of {docs.length} document
            {docs.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
