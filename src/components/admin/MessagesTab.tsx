"use client";

/**
 * src/components/admin/MessagesTab.tsx
 *
 * Secure Attorney-Client Messaging Interface.
 *
 * Fetches the message history for a client on mount via the internal proxy:
 *   GET  /api/admin/clients/{clientId}/messages
 *   POST /api/admin/clients/{clientId}/messages
 *
 * The httpOnly admin_session cookie is never touched by this component —
 * all authentication is handled server-side by the Next.js proxy route.
 *
 * UI:
 *   - Scrollable message history area (auto-scrolls to latest on new message)
 *   - LAWYER messages: right-aligned, navy background
 *   - CLIENT messages: left-aligned, light gray background
 *   - Pinned textarea + Send button at the bottom
 *   - Loading skeleton, empty state, and error state
 *
 * Props:
 *   clientId — UUID of the client whose thread to display
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  FormEvent,
  KeyboardEvent,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  senderType: "LAWYER" | "CLIENT";
  lawyerId: string | null;
  clientId: string;
  createdAt: string;
}

interface Props {
  clientId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessagesTab({ clientId }: Props) {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [newMessage, setNewMessage]   = useState("");
  const [loadPhase, setLoadPhase]     = useState<"loading" | "ready" | "error">("loading");
  const [isSending, setIsSending]     = useState(false);
  const [sendError, setSendError]     = useState<string | null>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // ── Fetch message history ─────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { messages: Message[] };
      setMessages(data.messages ?? []);
      setLoadPhase("ready");
    } catch {
      setLoadPhase("error");
    }
  }, [clientId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Auto-scroll to bottom when messages change ────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || isSending) return;

    setSendError(null);
    setIsSending(true);

    // Optimistic UI — append immediately so the conversation feels instant
    const optimistic: Message = {
      id:         `optimistic-${Date.now()}`,
      content,
      senderType: "LAWYER",
      lawyerId:   null,
      clientId,
      createdAt:  new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Server error (HTTP ${res.status})`);
      }

      const data = await res.json() as { message: Message };

      // Replace the optimistic bubble with the confirmed server record
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m))
      );
    } catch (err) {
      // Roll back the optimistic message and surface the error
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(content); // restore draft
      setSendError(err instanceof Error ? err.message : "Failed to send. Try again.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [clientId, newMessage, isSending]);

  // Allow Ctrl+Enter or Cmd+Enter to submit
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

  // ── Render states ─────────────────────────────────────────────────────────

  if (loadPhase === "loading") return <SkeletonLoader />;

  if (loadPhase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-error-bg flex items-center justify-center">
          <AlertIcon />
        </div>
        <p className="text-sm font-medium text-text-secondary">
          Could not load messages. Check your connection.
        </p>
        <button
          onClick={() => { setLoadPhase("loading"); fetchMessages(); }}
          className="text-sm font-semibold text-navy hover:text-navy-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[520px] max-h-[680px]">

      {/* ── Thread header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white rounded-tl-lg rounded-tr-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
            <LockIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary leading-none">Secure Channel</p>
            <p className="text-xs text-text-muted mt-0.5">Attorney–Client Privilege Protected</p>
          </div>
        </div>
        <button
          onClick={() => { setLoadPhase("loading"); fetchMessages(); }}
          title="Refresh messages"
          className="p-1.5 rounded-md text-text-muted hover:text-navy hover:bg-bg transition-colors"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* ── Message history ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-bg">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Send error banner ──────────────────────────────────────────────── */}
      {sendError && (
        <div className="px-6 py-2 bg-error-bg border-t border-red-100">
          <p className="text-xs text-error flex items-center gap-1.5">
            <AlertIcon size={12} />
            {sendError}
            <button
              onClick={() => setSendError(null)}
              className="ml-auto font-semibold underline text-error"
            >
              Dismiss
            </button>
          </p>
        </div>
      )}

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="px-6 py-4 border-t border-border bg-white rounded-bl-lg rounded-br-lg"
      >
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            id="message-input"
            rows={2}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Ctrl+Enter to send)"
            disabled={isSending}
            className={[
              "flex-1 resize-none rounded-lg border px-4 py-3",
              "text-sm text-text-primary placeholder-text-muted",
              "bg-bg-alt focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy",
              "transition-colors duration-150 disabled:opacity-60",
              "border-border",
            ].join(" ")}
          />
          <button
            id="send-message-btn"
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className={[
              "flex items-center gap-2 px-5 py-3 rounded-lg",
              "text-sm font-semibold text-white",
              "bg-navy hover:bg-navy-hover active:scale-95",
              "transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-sm whitespace-nowrap flex-shrink-0",
            ].join(" ")}
          >
            {isSending ? (
              <>
                <SendingSpinner />
                Sending…
              </>
            ) : (
              <>
                <SendIcon />
                Send
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Messages are visible to the assigned attorney only. Protected under attorney-client privilege.
        </p>
      </form>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isLawyer = message.senderType === "LAWYER";
  const time = new Date(message.createdAt).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
  });
  const date = new Date(message.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
  });

  return (
    <div className={`flex ${isLawyer ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className={`max-w-[72%] ${isLawyer ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {/* Sender label */}
        <span className={`text-xs font-medium ${isLawyer ? "text-right text-navy" : "text-left text-text-muted"}`}>
          {isLawyer ? "Attorney" : "Client"}
        </span>

        {/* Bubble */}
        <div
          className={[
            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
            isLawyer
              ? "bg-navy text-white rounded-tr-sm"
              : "bg-white text-text-primary border border-border rounded-tl-sm",
          ].join(" ")}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-text-muted">
          {date} · {time}
        </span>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-alt border border-border flex items-center justify-center">
        <ChatIcon />
      </div>
      <p className="text-sm font-semibold text-text-secondary">No messages yet</p>
      <p className="text-xs text-text-muted max-w-xs">
        Start the conversation below. All communications are logged and protected under attorney-client privilege.
      </p>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="flex flex-col min-h-[520px]">
      {/* Header skeleton */}
      <div className="px-6 py-4 border-b border-border bg-white flex items-center gap-3 rounded-tl-lg rounded-tr-lg">
        <div className="w-8 h-8 rounded-full bg-bg-alt animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="w-24 h-3 bg-bg-alt rounded animate-pulse" />
          <div className="w-40 h-2.5 bg-bg-alt rounded animate-pulse" />
        </div>
      </div>
      {/* Message skeletons */}
      <div className="flex-1 bg-bg px-6 py-5 space-y-4">
        {[false, true, false, true].map((right, i) => (
          <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
            <div
              className={`h-10 rounded-2xl bg-bg-alt animate-pulse ${right ? "w-48" : "w-60"}`}
              style={{ animationDelay: `${i * 120}ms` }}
            />
          </div>
        ))}
      </div>
      {/* Input skeleton */}
      <div className="px-6 py-4 border-t border-border bg-white rounded-bl-lg rounded-br-lg">
        <div className="flex gap-3">
          <div className="flex-1 h-16 rounded-lg bg-bg-alt animate-pulse" />
          <div className="w-20 h-16 rounded-lg bg-bg-alt animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function SendingSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
