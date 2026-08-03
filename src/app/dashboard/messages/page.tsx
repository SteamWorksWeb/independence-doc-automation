"use client";

/**
 * src/app/dashboard/messages/page.tsx
 *
 * Client Message Center
 * ─────────────────────
 * Client-facing conversation thread with their attorney.
 *
 * Data flow
 * ─────────
 *  1. GET  /api/client/conversations        → discover the client's conversation
 *  2. GET  /api/client/conversations/:id/messages → load history
 *  3. POST /api/client/conversations/:id/messages → send message
 *     Body: { body: string; attachmentKey?: string }
 *
 * File attachments
 * ────────────────
 *  Paperclip button opens a hidden file input. On selection the file is uploaded
 *  via uploadClientFileToS3 (category="message-attachment") and the returned
 *  s3Key is attached to the next sent message.
 *
 * Visual conventions (inverse of StaffMessageThread)
 *  Client  → right-aligned, navy bubble
 *  Attorney → left-aligned, white bubble
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  FormEvent,
  KeyboardEvent,
} from "react";
import { uploadClientFileToS3 } from "@/lib/uploadClientFileToS3";

// ── Types ─────────────────────────────────────────────────────────────────────

type SenderType = "STAFF" | "BORROWER";
type Visibility = "CLIENT_VISIBLE" | "INTERNAL";

interface Message {
  id: string;
  body: string;
  senderType: SenderType;
  visibility: Visibility;
  attachmentKey?: string | null;
  attachmentName?: string | null;
  createdAt: string;
}

interface Conversation {
  id: string;
}

type Phase = "discovering" | "loading" | "ready" | "no-thread" | "error";

interface PendingAttachment {
  file: File;
  s3Key: string | null;
  status: "pending" | "uploading" | "ready" | "error";
  errorMsg?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractConversation(data: unknown): Conversation | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;

  if (Array.isArray(d)) {
    const first = (d as unknown[])[0];
    return extractConversation(first);
  }
  if (Array.isArray(d.conversations)) {
    return extractConversation((d.conversations as unknown[])[0]);
  }
  if (d.conversation && typeof (d.conversation as Record<string, unknown>).id === "string") {
    return d.conversation as Conversation;
  }
  if (typeof d.id === "string") return d as unknown as Conversation;
  return null;
}

function extractMessages(data: unknown): Message[] {
  if (Array.isArray(data)) return data as Message[];
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.messages)) return d.messages as Message[];
  const conv = d.conversation as Record<string, unknown> | undefined;
  if (conv && Array.isArray(conv.messages)) return conv.messages as Message[];
  return [];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientMessagesPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [newMessage,     setNewMessage]     = useState("");
  const [phase,          setPhase]          = useState<Phase>("discovering");
  const [isSending,      setIsSending]      = useState(false);
  const [sendError,      setSendError]      = useState<string | null>(null);
  const [isCreating,     setIsCreating]     = useState(false);
  const [createError,    setCreateError]    = useState<string | null>(null);

  // Attachment state
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Step 1: Discover conversation ─────────────────────────────────────────

  const discoverConversation = useCallback(async () => {
    setPhase("discovering");
    try {
      const res = await fetch("/api/client/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const conv = extractConversation(data);
      if (!conv?.id) {
        setPhase("no-thread");
        return;
      }
      setConversationId(conv.id);
      setPhase("loading");
    } catch {
      setPhase("error");
    }
  }, []);

  // ── Step 2: Load messages ─────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setPhase("loading");
    try {
      const res = await fetch(`/api/client/conversations/${conversationId}/messages`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      setMessages(extractMessages(data));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [conversationId]);

  useEffect(() => { discoverConversation(); }, [discoverConversation]);
  useEffect(() => { if (phase === "loading" && conversationId) fetchMessages(); }, [phase, conversationId, fetchMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Create conversation ────────────────────────────────────────────────────

  const handleStartConversation = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/client/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Server error (HTTP ${res.status})`);
      }
      const data: unknown = await res.json();
      const conv = extractConversation(data);
      if (!conv?.id) throw new Error("No conversation ID in response.");
      setConversationId(conv.id);
      setPhase("loading");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to start conversation.");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  // ── Attachment handling ────────────────────────────────────────────────────

  function handleAttachClick() {
    attachInputRef.current?.click();
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const pending: PendingAttachment = { file, s3Key: null, status: "uploading" };
    setAttachment(pending);

    try {
      const doc = await uploadClientFileToS3(file, "message-attachment");
      setAttachment({ file, s3Key: doc.s3Key, status: "ready" });
    } catch (err) {
      setAttachment({
        file,
        s3Key: null,
        status: "error",
        errorMsg: err instanceof Error ? err.message : "Attachment upload failed.",
      });
    }

    // Reset input so the same file can be re-selected
    if (attachInputRef.current) attachInputRef.current.value = "";
  }

  function removeAttachment() {
    setAttachment(null);
    if (attachInputRef.current) attachInputRef.current.value = "";
  }

  // ── Step 3: Send message ───────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const body = newMessage.trim();
    const hasAttachment = attachment?.status === "ready";

    if ((!body && !hasAttachment) || isSending || !conversationId) return;
    if (attachment?.status === "uploading") return; // wait for attachment

    setSendError(null);
    setIsSending(true);

    const optimistic: Message = {
      id:        `optimistic-${Date.now()}`,
      body:      body || `[Attachment: ${attachment?.file.name ?? "file"}]`,
      senderType: "BORROWER",
      visibility: "CLIENT_VISIBLE",
      attachmentKey:  attachment?.s3Key ?? null,
      attachmentName: attachment?.file.name ?? null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setAttachment(null);

    try {
      const res = await fetch(`/api/client/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body || "",
          ...(optimistic.attachmentKey ? { attachmentKey: optimistic.attachmentKey } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? `Server error (HTTP ${res.status})`);
      }

      const data = await res.json() as { message?: Message } | Message;
      const confirmed: Message = "message" in data && data.message ? data.message : data as Message;

      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? confirmed : m));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(body);
      setSendError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [conversationId, newMessage, attachment, isSending]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); handleSend(); };

  // ── Phase renders ─────────────────────────────────────────────────────────

  if (phase === "discovering" || phase === "loading") {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader />
        <MessageSkeleton />
      </div>
    );
  }

  if (phase === "no-thread") {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader />
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-5 py-20 px-8 text-center min-h-[400px]">
            <div className="w-14 h-14 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center">
              <ComposeIcon size={24} color="#1d4ed8" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy">No message thread yet</p>
              <p className="text-xs text-text-muted max-w-xs mt-1">
                Start a secure conversation with your attorney. They'll respond within 48 hours.
              </p>
            </div>
            {createError && (
              <p className="text-xs text-error bg-error-bg border border-error/20 rounded-lg px-3 py-2 max-w-xs">{createError}</p>
            )}
            <button
              id="client-start-conversation-btn"
              onClick={handleStartConversation}
              disabled={isCreating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95 ${
                isCreating ? "bg-[#93c5fd] cursor-not-allowed" : "bg-navy hover:bg-[#0f1f3d]"
              }`}
            >
              {isCreating ? <><SendingSpinner /> Starting…</> : <><ComposeIcon size={13} color="white" /> Start Conversation</>}
            </button>
            <button
              onClick={discoverConversation}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2"
            >
              Retry discovery
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader />
        <div className="bg-white border border-border rounded-lg shadow-sm flex flex-col items-center justify-center gap-4 py-20 px-8 text-center min-h-[400px]">
          <div className="w-12 h-12 rounded-full bg-error-bg flex items-center justify-center text-error">
            <AlertIcon />
          </div>
          <p className="text-sm font-medium text-text-primary">Could not load messages. Check your connection.</p>
          <button
            onClick={() => conversationId ? fetchMessages() : discoverConversation()}
            className="text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Ready ──────────────────────────────────────────────────────────────────

  const canSend =
    (newMessage.trim().length > 0 || attachment?.status === "ready") &&
    !isSending &&
    attachment?.status !== "uploading";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader />

      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "560px" }}>

        {/* Thread header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-[#f8fafc]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center shrink-0">
              <LockIcon />
            </div>
            <div>
              <p className="text-xs font-semibold text-navy leading-none">Secure Channel</p>
              <p className="text-[0.688rem] text-text-muted mt-0.5">Attorney–Client Privilege Protected</p>
            </div>
          </div>
          <button
            onClick={() => { if (conversationId) fetchMessages(); }}
            title="Refresh messages"
            aria-label="Refresh messages"
            className="p-1.5 rounded-md text-text-muted hover:text-navy hover:bg-border/40 transition-colors duration-150"
          >
            <RefreshIcon />
          </button>
        </div>

        {/* Message history */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#f3f4f6]">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Send error */}
        {sendError && (
          <div className="px-5 py-2 bg-error-bg border-t border-error/10">
            <p className="text-xs text-error flex items-center gap-1.5">
              <AlertIcon size={12} />
              {sendError}
              <button onClick={() => setSendError(null)} className="ml-auto font-semibold underline">
                Dismiss
              </button>
            </p>
          </div>
        )}

        {/* Pending attachment chip */}
        {attachment && (
          <div className="px-5 pt-3 pb-0">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              attachment.status === "uploading"
                ? "bg-[#eff4ff] border-[#bfdbfe] text-[#1d4ed8]"
                : attachment.status === "ready"
                ? "bg-success-bg border-success/30 text-success"
                : "bg-error-bg border-error/20 text-error"
            }`}>
              {attachment.status === "uploading" && <SendingSpinner />}
              {attachment.status === "ready" && <span className="text-success">✓</span>}
              {attachment.status === "error" && <span>✕</span>}
              <span className="max-w-[200px] truncate">{attachment.file.name}</span>
              {attachment.status === "error" && attachment.errorMsg && (
                <span className="text-[0.65rem] opacity-80">— {attachment.errorMsg}</span>
              )}
              <button
                onClick={removeAttachment}
                aria-label="Remove attachment"
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Compose area */}
        <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-border bg-white">
          <textarea
            ref={textareaRef}
            id="client-message-input"
            rows={3}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to your attorney… (Ctrl+Enter to send)"
            disabled={isSending}
            className="w-full resize-none rounded-lg border px-4 py-3 text-sm text-navy placeholder-text-muted outline-none transition-colors duration-150 disabled:opacity-60 bg-[#f8fafc] border-border focus:border-navy focus:ring-2 focus:ring-navy/10"
          />

          <div className="mt-3 flex items-center gap-3">

            {/* Attachment button */}
            <button
              type="button"
              id="client-attach-btn"
              onClick={handleAttachClick}
              title="Attach a file"
              aria-label="Attach a file"
              disabled={isSending || attachment?.status === "uploading"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-150 ${
                attachment?.status === "ready"
                  ? "bg-success-bg border-success/30 text-success"
                  : "bg-bg border-border text-text-muted hover:border-navy hover:text-navy"
              }`}
            >
              <PaperclipIcon />
              <span className="hidden sm:inline">
                {attachment?.status === "ready" ? "Attached" : "Attach"}
              </span>
            </button>

            {/* Hidden file input */}
            <input
              ref={attachInputRef}
              id="client-attach-input"
              type="file"
              className="sr-only"
              onChange={handleAttachFile}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
            />

            {/* Send button */}
            <button
              id="client-send-message-btn"
              type="submit"
              disabled={!canSend}
              className={`ml-auto flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap flex-shrink-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 bg-navy hover:bg-[#0f1f3d]`}
            >
              {isSending ? <><SendingSpinner /> Sending…</> : <><SendIcon /> Send</>}
            </button>
          </div>

          <p className="mt-2 text-[0.688rem] text-text-muted">
            Messages are protected under attorney–client privilege. Ctrl+Enter to send.
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-serif text-[clamp(1.375rem,2.5vw,1.75rem)] font-black italic text-navy leading-[1.1]">
        Message Center
      </h1>
      <p className="text-[0.9375rem] text-text-muted leading-relaxed">
        Communicate securely with your attorney. All messages are protected under attorney–client privilege.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isClient = message.senderType === "BORROWER";
  const time = formatTime(message.createdAt);
  const date = formatDate(message.createdAt);

  return (
    <div className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[74%] flex flex-col gap-1 ${isClient ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${isClient ? "text-navy" : "text-text-muted"}`}>
            {isClient ? "You" : "Attorney"}
          </span>
        </div>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isClient
            ? "bg-navy text-white rounded-tr-sm"
            : "bg-white text-navy border border-border rounded-tl-sm"
        }`}>
          {message.body}
          {message.attachmentName && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
              isClient ? "bg-white/10 text-white/80" : "bg-bg text-text-muted"
            }`}>
              <PaperclipIcon size={11} />
              <span className="truncate max-w-[160px]">{message.attachmentName}</span>
            </div>
          )}
        </div>
        <span className="text-[0.688rem] text-text-muted">{date} · {time}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="w-11 h-11 rounded-full bg-white border border-border flex items-center justify-center">
        <ChatIcon />
      </div>
      <p className="text-sm font-semibold text-text-primary">No messages yet</p>
      <p className="text-xs text-text-muted max-w-[18rem]">
        Send your first message below. Your attorney will respond within 48 hours.
      </p>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[480px]">
      <div className="px-5 py-3.5 border-b border-border bg-[#f8fafc] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-border animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="w-20 h-2.5 bg-border rounded animate-pulse" />
          <div className="w-36 h-2 bg-border rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 bg-[#f3f4f6] px-5 py-4 space-y-3">
        {[false, true, false, true].map((right, i) => (
          <div key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
            <div
              className={`h-10 rounded-2xl bg-border animate-pulse ${right ? "w-44" : "w-56"}`}
              style={{ animationDelay: `${i * 100}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="px-5 py-4 border-t border-border bg-white">
        <div className="h-16 rounded-lg bg-[#f3f4f6] animate-pulse" />
        <div className="mt-3 flex gap-3">
          <div className="w-24 h-9 rounded-lg bg-[#f3f4f6] animate-pulse" />
          <div className="ml-auto w-20 h-9 rounded-lg bg-[#f3f4f6] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function PaperclipIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
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
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
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

function SendingSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
