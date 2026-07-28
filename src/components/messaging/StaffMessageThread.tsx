"use client";

/**
 * src/components/messaging/StaffMessageThread.tsx
 *
 * Reusable Staff ↔ Borrower messaging thread — Staff view.
 *
 * Usage (D1 / D6 — drop-in anywhere):
 *   <StaffMessageThread borrowerId="<uuid>" />
 *
 * Data flow:
 *   1. GET  /api/admin/conversations?borrowerId=<id>  → find the conversation
 *   2. GET  /api/admin/conversations/<convId>/messages → load history
 *   3. POST /api/admin/conversations/<convId>/messages → send message
 *      Body: { body: string; visibility: "CLIENT_VISIBLE" | "INTERNAL" }
 *
 * Auth: All API calls go through Next.js server-side proxy routes that read
 *       the HttpOnly admin_session cookie. Browser JS never touches the JWT.
 *
 * Message visibility (D3):
 *   CLIENT_VISIBLE — shown to borrower
 *   INTERNAL       — staff-only note, highlighted in amber
 *
 * Visual conventions:
 *   Staff (CLIENT_VISIBLE) → right-aligned, navy bubble
 *   Borrower               → left-aligned, white bubble
 *   INTERNAL note          → right-aligned, amber/yellow bubble + lock badge
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  FormEvent,
  KeyboardEvent,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Visibility = "CLIENT_VISIBLE" | "INTERNAL";
type SenderType = "STAFF" | "BORROWER";

export interface ThreadMessage {
  id: string;
  body: string;
  senderType: SenderType;
  visibility: Visibility;
  senderUserId?: string | null;
  createdAt: string;
}

interface MessagesResponse {
  conversation?: {
    messages?: ThreadMessage[];
  } | null;
  messages?: ThreadMessage[];
}

interface Conversation {
  id: string;
  borrowerId?: string;
  clientId?: string;
}

export interface StaffMessageThreadProps {
  /** UUID of the borrower/client whose thread to display */
  borrowerId: string;
  /** Optional: supply a known conversationId to skip the discovery fetch */
  conversationId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffMessageThread({
  borrowerId,
  conversationId: suppliedConversationId,
}: StaffMessageThreadProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    suppliedConversationId ?? null
  );
  const [messages, setMessages]     = useState<ThreadMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  type Phase = "discovering" | "loading" | "ready" | "no-thread" | "error";
  const [phase, setPhase]           = useState<Phase>(
    suppliedConversationId ? "loading" : "discovering"
  );
  const [isSending, setIsSending]   = useState(false);
  const [sendError, setSendError]   = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Step 1: Discover conversation ID ───────────────────────────────────────

  const discoverConversation = useCallback(async () => {
    if (conversationId) {
      // Already known — skip straight to loading messages
      setPhase("loading");
      return;
    }
    setPhase("discovering");
    try {
      const res = await fetch(
        `/api/admin/conversations?borrowerId=${encodeURIComponent(borrowerId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as
        | { conversations: Conversation[] }
        | { conversation: Conversation }
        | Conversation[]
        | Conversation;

      // Normalise various response shapes the backend might return
      let conv: Conversation | null = null;
      if (Array.isArray(data)) {
        conv = data[0] ?? null;
      } else if ("conversations" in data && Array.isArray(data.conversations)) {
        conv = data.conversations[0] ?? null;
      } else if ("conversation" in data) {
        conv = (data as { conversation: Conversation }).conversation;
      } else if ("id" in data) {
        conv = data as Conversation;
      }

      if (!conv?.id) {
        setPhase("no-thread");
        return;
      }

      setConversationId(conv.id);
      setPhase("loading");
    } catch {
      setPhase("error");
    }
  }, [borrowerId, conversationId]);

  // ── Step 2: Load message history ───────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setPhase("loading");
    try {
      const res = await fetch(
        `/api/admin/conversations/${conversationId}/messages`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as MessagesResponse | ThreadMessage[];

      const list = Array.isArray(data)
        ? data
        : (data.conversation?.messages ?? data.messages ?? []);
      setMessages(list);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [conversationId]);

  // Boot sequence
  useEffect(() => {
    if (!suppliedConversationId) {
      discoverConversation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  useEffect(() => {
    if (phase === "loading" && conversationId) {
      fetchMessages();
    }
  }, [phase, conversationId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Step 3: Send a message ─────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const messageBody = newMessage.trim();
    if (!messageBody || isSending || !conversationId) return;

    setSendError(null);
    setIsSending(true);

    const visibility: Visibility = isInternal ? "INTERNAL" : "CLIENT_VISIBLE";

    // Optimistic bubble
    const optimistic: ThreadMessage = {
      id:         `optimistic-${Date.now()}`,
      body:       messageBody,
      senderType: "STAFF",
      visibility,
      senderUserId: null,
      createdAt:  new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    try {
      const res = await fetch(
        `/api/admin/conversations/${conversationId}/messages`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ body: messageBody, visibility }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string; message?: string };
        throw new Error(errData.message ?? errData.error ?? `Server error (HTTP ${res.status})`);
      }

      const data = await res.json() as { message: ThreadMessage } | ThreadMessage;
      const confirmed: ThreadMessage = "message" in data ? data.message : data;

      // Replace optimistic with confirmed
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? confirmed : m))
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(messageBody);
      setSendError(err instanceof Error ? err.message : "Failed to send. Try again.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [conversationId, borrowerId, newMessage, isInternal, isSending]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  // ── Render: loading / error / no-thread states ─────────────────────────────

  if (phase === "discovering" || phase === "loading") return <SkeletonLoader />;

  // ── Start conversation handler ─────────────────────────────────────────────

  const handleStartConversation = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrowerId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(errData.message ?? errData.error ?? `Server error (HTTP ${res.status})`);
      }
      const data = await res.json() as { conversation?: { id: string } };
      const convId = data.conversation?.id;
      if (!convId) throw new Error("No conversation ID in response.");
      setConversationId(convId);
      setPhase("loading");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to start conversation.");
    } finally {
      setIsCreating(false);
    }
  }, [borrowerId, isCreating]);

  if (phase === "no-thread") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 px-8 text-center min-h-[360px]">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center">
          <ComposeIcon />
        </div>

        {/* Copy */}
        <div>
          <p className="text-sm font-bold text-[#1a2744]">No message thread yet</p>
          <p className="text-xs text-[#6b7280] max-w-xs mt-1">
            Start a secure conversation with this borrower. They'll see your
            message when they next log into their portal.
          </p>
        </div>

        {/* Error banner */}
        {createError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs">
            {createError}
          </p>
        )}

        {/* Primary CTA */}
        <button
          id="start-conversation-btn"
          onClick={handleStartConversation}
          disabled={isCreating}
          className={[
            "flex items-center gap-2 px-6 py-2.5 rounded-lg",
            "text-sm font-semibold text-white shadow-sm",
            "transition-all duration-150 active:scale-95",
            isCreating
              ? "bg-[#93c5fd] cursor-not-allowed"
              : "bg-[#1d4ed8] hover:bg-[#1e40af]",
          ].join(" ")}
        >
          {isCreating ? (
            <>
              <SendingSpinner />
              Starting…
            </>
          ) : (
            <>
              <ComposeIcon size={13} color="white" />
              Start Conversation
            </>
          )}
        </button>

        {/* Retry discovery link */}
        <button
          onClick={() => { setConversationId(null); discoverConversation(); }}
          className="text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors underline underline-offset-2"
        >
          Retry discovery
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center min-h-[360px]">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertIcon />
        </div>
        <p className="text-sm font-medium text-[#374151]">
          Could not load messages. Check your connection.
        </p>
        <button
          onClick={() => {
            if (conversationId) fetchMessages();
            else discoverConversation();
          }}
          className="text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render: ready ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-[480px]">

      {/* ── Thread header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e7eb] bg-[#f8fafc]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#1a2744] flex items-center justify-center flex-shrink-0">
            <LockIcon />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1a2744] leading-none">Secure Channel</p>
            <p className="text-[0.688rem] text-[#6b7280] mt-0.5">Attorney–Client Privilege Protected</p>
          </div>
        </div>
        <button
          onClick={() => { if (conversationId) fetchMessages(); }}
          title="Refresh messages"
          aria-label="Refresh messages"
          className="p-1.5 rounded-md text-[#6b7280] hover:text-[#1a2744] hover:bg-[#e5e7eb] transition-colors duration-150"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* ── Message history ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#f3f4f6]">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Send error banner ──────────────────────────────────────────────── */}
      {sendError && (
        <div className="px-5 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertIcon size={12} />
            {sendError}
            <button
              onClick={() => setSendError(null)}
              className="ml-auto font-semibold underline text-red-600"
            >
              Dismiss
            </button>
          </p>
        </div>
      )}

      {/* ── Internal note indicator ─────────────────────────────────────────── */}
      {isInternal && (
        <div className="px-5 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-1.5">
          <InternalNoteIcon />
          <p className="text-[0.688rem] font-semibold text-amber-700 uppercase tracking-wide">
            Internal Note Mode — Hidden from client
          </p>
        </div>
      )}

      {/* ── Compose area ──────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="px-5 py-4 border-t border-[#e5e7eb] bg-white"
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="staff-message-input"
          rows={3}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isInternal
              ? "Write an internal note… (only staff can see this)"
              : "Type a message to the borrower… (Ctrl+Enter to send)"
          }
          disabled={isSending}
          className={[
            "w-full resize-none rounded-lg border px-4 py-3",
            "text-sm text-[#1a2744] placeholder-[#9ca3af]",
            "outline-none transition-colors duration-150 disabled:opacity-60",
            isInternal
              ? "bg-amber-50 border-amber-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              : "bg-[#f8fafc] border-[#d1d5db] focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20",
          ].join(" ")}
        />

        {/* Controls row */}
        <div className="mt-3 flex items-center justify-between gap-3">

          {/* D3: Internal Note toggle */}
          <label
            htmlFor="staff-internal-toggle"
            className={[
              "flex items-center gap-2 cursor-pointer select-none",
              "px-3 py-2 rounded-lg border transition-all duration-150",
              isInternal
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-[#f3f4f6] border-[#e5e7eb] text-[#374151] hover:border-[#d1d5db]",
            ].join(" ")}
          >
            <div className="relative flex-shrink-0">
              <input
                id="staff-internal-toggle"
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="sr-only"
              />
              {/* Custom toggle track */}
              <div
                className={[
                  "w-9 h-5 rounded-full transition-colors duration-200",
                  isInternal ? "bg-amber-400" : "bg-[#d1d5db]",
                ].join(" ")}
              />
              {/* Toggle thumb */}
              <div
                className={[
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm",
                  "transition-transform duration-200",
                  isInternal ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
              />
            </div>
            <span className="text-xs font-semibold whitespace-nowrap">
              Internal Note{isInternal ? " (Hidden from Client)" : ""}
            </span>
          </label>

          {/* Send button */}
          <button
            id="staff-send-message-btn"
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={[
              "flex items-center gap-2 px-5 py-2.5 rounded-lg",
              "text-sm font-semibold text-white whitespace-nowrap flex-shrink-0",
              "transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-sm active:scale-95",
              isInternal
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-[#1d4ed8] hover:bg-[#1e40af]",
            ].join(" ")}
          >
            {isSending ? (
              <>
                <SendingSpinner />
                Sending…
              </>
            ) : (
              <>
                {isInternal ? <InternalNoteIcon color="white" /> : <SendIcon />}
                {isInternal ? "Save Note" : "Send"}
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-[0.688rem] text-[#9ca3af]">
          {isInternal
            ? "⚠ Internal notes are never shown to the borrower."
            : "Messages are protected under attorney–client privilege. Ctrl+Enter to send."}
        </p>
      </form>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ThreadMessage }) {
  const isStaff    = message.senderType !== "BORROWER";
  const isInternal = message.visibility === "INTERNAL";

  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
  const date = new Date(message.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <div className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[74%] flex flex-col gap-1 ${isStaff ? "items-end" : "items-start"}`}>

        {/* Sender / visibility badge row */}
        <div className="flex items-center gap-1.5">
          {isInternal && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide">
              <InternalNoteIcon size={9} />
              Internal
            </span>
          )}
          <span className={`text-xs font-medium ${isStaff ? "text-[#1a2744]" : "text-[#6b7280]"}`}>
            {isStaff ? "Attorney" : "Borrower"}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={[
            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
            isInternal
              ? "bg-amber-50 border border-amber-300 text-amber-900 rounded-tr-sm"
              : isStaff
                ? "bg-[#1a2744] text-white rounded-tr-sm"
                : "bg-white text-[#1a2744] border border-[#e5e7eb] rounded-tl-sm",
          ].join(" ")}
        >
          {message.body}
        </div>

        {/* Timestamp */}
        <span className="text-[0.688rem] text-[#9ca3af]">
          {date} · {time}
        </span>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="w-11 h-11 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center">
        <ChatIcon />
      </div>
      <p className="text-sm font-semibold text-[#374151]">No messages yet</p>
      <p className="text-xs text-[#6b7280] max-w-[18rem]">
        Start the conversation below. All communications are logged and protected
        under attorney-client privilege.
      </p>
    </div>
  );
}

// ── SkeletonLoader ────────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="flex flex-col min-h-[480px]">
      {/* Header skeleton */}
      <div className="px-5 py-3.5 border-b border-[#e5e7eb] bg-[#f8fafc] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#e5e7eb] animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="w-20 h-2.5 bg-[#e5e7eb] rounded animate-pulse" />
          <div className="w-36 h-2 bg-[#e5e7eb] rounded animate-pulse" />
        </div>
      </div>
      {/* Message skeletons */}
      <div className="flex-1 bg-[#f3f4f6] px-5 py-4 space-y-3">
        {[false, true, false, true, false].map((right, i) => (
          <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
            <div
              className={`h-10 rounded-2xl bg-[#e5e7eb] animate-pulse ${right ? "w-48" : "w-60"}`}
              style={{ animationDelay: `${i * 100}ms` }}
            />
          </div>
        ))}
      </div>
      {/* Input skeleton */}
      <div className="px-5 py-4 border-t border-[#e5e7eb] bg-white">
        <div className="h-16 rounded-lg bg-[#f3f4f6] animate-pulse" />
        <div className="mt-3 flex gap-3">
          <div className="w-44 h-9 rounded-lg bg-[#f3f4f6] animate-pulse" />
          <div className="ml-auto w-24 h-9 rounded-lg bg-[#f3f4f6] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ComposeIcon({ size = 20, color = "#1d4ed8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
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

function InternalNoteIcon({ size = 11, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function SendingSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
