"use client";

/**
 * src/app/admin/message-center/page.tsx
 *
 * Global Message Center — Staff triage inbox (Slice 6).
 *
 * Layout:
 *   Left sidebar  (1/3) — Scrollable conversation list with unread badges.
 *                         Sorted: unread first, then by most recently updated.
 *   Right pane    (2/3) — Active conversation rendered via <StaffMessageThread>.
 *                         Empty state when nothing is selected.
 *
 * Data flow:
 *   1. On mount:  GET /api/admin/conversations          → all conversations
 *   2. On select: POST /api/admin/conversations/[id]/read → clears unread badge
 *                 Mount <StaffMessageThread conversationId=... borrowerId=...>
 *
 * Auth: All fetches go through Next.js server-side proxy routes (HttpOnly cookie).
 */

import React, { useCallback, useEffect, useState } from "react";
import StaffMessageThread from "@/components/messaging/StaffMessageThread";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  borrowerId?: string;
  clientId?: string;
  unreadCount?: number;
  updatedAt?: string;
  createdAt?: string;
  client?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  borrower?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  /** Some backends nest status directly */
  status?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBorrowerName(conv: ConversationSummary): string {
  const person = conv.client ?? conv.borrower;
  if (!person) return "Unknown Borrower";
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return full || person.email || "Unknown Borrower";
}

function getBorrowerId(conv: ConversationSummary): string {
  return conv.borrowerId ?? conv.clientId ?? "";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortConversations(list: ConversationSummary[]): ConversationSummary[] {
  return [...list].sort((a, b) => {
    const aUnread = (a.unreadCount ?? 0) > 0 ? 1 : 0;
    const bUnread = (b.unreadCount ?? 0) > 0 ? 1 : 0;
    if (bUnread !== aUnread) return bUnread - aUnread; // unread first
    const aDate = a.updatedAt ?? a.createdAt ?? "";
    const bDate = b.updatedAt ?? b.createdAt ?? "";
    return bDate.localeCompare(aDate); // most recent first
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MessageCenterPage() {
  const [conversations, setConversations]   = useState<ConversationSummary[]>([]);
  const [loading, setLoading]               = useState(true);
  const [fetchError, setFetchError]         = useState<string | null>(null);
  const [activeId, setActiveId]             = useState<string | null>(null);

  // ── Fetch conversation list ─────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as
        | { conversations: ConversationSummary[] }
        | ConversationSummary[];

      const list = Array.isArray(data) ? data : (data.conversations ?? []);
      setConversations(sortConversations(list));
    } catch {
      setFetchError("Failed to load conversations. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Select a conversation & mark as read ────────────────────────────────────

  const handleSelect = useCallback(async (conv: ConversationSummary) => {
    setActiveId(conv.id);

    // Clear badge optimistically in UI
    setConversations((prev) =>
      prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c)
    );

    // Fire-and-forget POST /read
    try {
      await fetch(`/api/admin/conversations/${conv.id}/read`, { method: "POST" });
    } catch {
      // Non-critical — ignore silently
    }
  }, []);

  // ── Derived: active conversation record ─────────────────────────────────────

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-screen bg-[#f3f4f6]">

      {/* ── Left sidebar: Conversation list ───────────────────────────────── */}
      <aside
        className="w-1/3 min-w-[280px] max-w-[380px] bg-white border-r border-[#e5e7eb] flex flex-col shadow-sm"
        aria-label="Conversation list"
      >
        {/* Sidebar header */}
        <div className="px-5 py-4 border-b border-[#e5e7eb] bg-[#f8fafc] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a2744] flex items-center justify-center shrink-0">
              <InboxIcon />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#1a2744] leading-none">Message Center</h1>
              <p className="text-[0.68rem] text-[#6b7280] mt-0.5">Staff Triage Inbox</p>
            </div>
          </div>
          <button
            onClick={loadConversations}
            title="Refresh conversations"
            aria-label="Refresh conversations"
            className="p-1.5 rounded-md text-[#6b7280] hover:text-[#1a2744] hover:bg-[#e5e7eb] transition-colors duration-150 shrink-0"
          >
            <RefreshIcon />
          </button>
        </div>

        {/* Conversation list body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ConversationListSkeleton />
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertIcon />
              </div>
              <p className="text-sm text-[#374151] font-medium">{fetchError}</p>
              <button
                onClick={loadConversations}
                className="text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
              >
                Try again
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center">
                <ChatIcon />
              </div>
              <p className="text-sm font-semibold text-[#374151]">No conversations yet</p>
              <p className="text-xs text-[#6b7280] max-w-[14rem]">
                Conversations will appear here once borrowers activate their portal accounts.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#f3f4f6]" role="list">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeId}
                  onSelect={handleSelect}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer: conversation count */}
        {!loading && !fetchError && conversations.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[#e5e7eb] bg-[#f8fafc] shrink-0">
            <p className="text-[0.68rem] text-[#9ca3af] text-center">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </aside>

      {/* ── Right pane: Active chat ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeConv ? (
          <>
            {/* Thread header bar */}
            <div className="px-6 py-3.5 bg-white border-b border-[#e5e7eb] flex items-center gap-3 shrink-0 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-[#1a2744] flex items-center justify-center shrink-0 text-white text-sm font-bold uppercase">
                {getBorrowerName(activeConv).charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-[#1a2744] leading-none">
                  {getBorrowerName(activeConv)}
                </p>
                <p className="text-[0.7rem] text-[#6b7280] mt-0.5">
                  Last updated {formatDate(activeConv.updatedAt ?? activeConv.createdAt)}
                  {activeConv.status && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase tracking-wide bg-[#e5e7eb] text-[#374151]">
                      {activeConv.status}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <StaffMessageThread
                borrowerId={getBorrowerId(activeConv)}
                conversationId={activeConv.id}
              />
            </div>
          </>
        ) : (
          /* Empty state — no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#e5e7eb] shadow-sm flex items-center justify-center">
              <EmptyInboxIcon />
            </div>
            <div>
              <p className="text-base font-bold text-[#1a2744]">Select a conversation to begin</p>
              <p className="text-sm text-[#6b7280] mt-1.5 max-w-xs">
                Choose a borrower thread from the list on the left to view messages and reply.
              </p>
            </div>
            {conversations.length > 0 && (
              <p className="text-xs text-[#9ca3af]">
                {conversations.filter((c) => (c.unreadCount ?? 0) > 0).length} unread thread
                {conversations.filter((c) => (c.unreadCount ?? 0) > 0).length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── ConversationCard ──────────────────────────────────────────────────────────

interface ConversationCardProps {
  conv: ConversationSummary;
  isActive: boolean;
  onSelect: (conv: ConversationSummary) => void;
}

function ConversationCard({ conv, isActive, onSelect }: ConversationCardProps) {
  const unread   = conv.unreadCount ?? 0;
  const hasUnread = unread > 0;
  const name     = getBorrowerName(conv);
  const date     = formatDate(conv.updatedAt ?? conv.createdAt);

  return (
    <li>
      <button
        onClick={() => onSelect(conv)}
        className={[
          "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d4ed8]",
          isActive
            ? "bg-[#eff6ff] border-l-[3px] border-[#1d4ed8]"
            : "bg-white border-l-[3px] border-transparent hover:bg-[#f8fafc]",
        ].join(" ")}
        aria-pressed={isActive}
        id={`conv-card-${conv.id}`}
      >
        {/* Avatar */}
        <div
          className={[
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold uppercase mt-0.5",
            hasUnread
              ? "bg-[#1d4ed8] text-white"
              : "bg-[#e5e7eb] text-[#374151]",
          ].join(" ")}
          aria-hidden
        >
          {name.charAt(0)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className={[
                "text-sm leading-snug truncate",
                hasUnread ? "font-bold text-[#1a2744]" : "font-semibold text-[#374151]",
              ].join(" ")}
            >
              {name}
            </span>
            {/* Unread count badge */}
            {hasUnread && (
              <span
                className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#dc2626] text-white text-[0.625rem] font-bold leading-none"
                aria-label={`${unread} unread message${unread !== 1 ? "s" : ""}`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
          <p className="text-[0.7rem] text-[#9ca3af] mt-0.5">{date}</p>
        </div>
      </button>
    </li>
  );
}

// ── ConversationListSkeleton ──────────────────────────────────────────────────

function ConversationListSkeleton() {
  return (
    <ul className="divide-y divide-[#f3f4f6]">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3.5">
          <div
            className="w-9 h-9 rounded-full bg-[#e5e7eb] animate-pulse shrink-0"
            style={{ animationDelay: `${i * 60}ms` }}
          />
          <div className="flex-1 space-y-2 pt-0.5">
            <div
              className="h-3 bg-[#e5e7eb] rounded animate-pulse"
              style={{ width: `${55 + (i % 3) * 15}%`, animationDelay: `${i * 60}ms` }}
            />
            <div
              className="h-2.5 bg-[#f3f4f6] rounded animate-pulse w-24"
              style={{ animationDelay: `${i * 60 + 30}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EmptyInboxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
