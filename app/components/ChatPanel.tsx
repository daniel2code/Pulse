"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Video, X, ShieldAlert, User, MessageCircle, AlertCircle } from "lucide-react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  remoteTyping,
  onTypingStart,
  onTypingStop,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  remoteTyping?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLocalTyping, setIsLocalTyping] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, remoteTyping]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsLocalTyping(false);
    onTypingStop?.();
  }

  const handleInputChange = (val: string) => {
    setDraft(val);
    if (!connected) return;

    if (!isLocalTyping && val.trim().length > 0) {
      setIsLocalTyping(true);
      onTypingStart?.();
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsLocalTyping(false);
      onTypingStop?.();
    }, 1500);
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0.9 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-white/10 bg-zinc-950/80 backdrop-blur-xl text-zinc-100 shadow-2xl"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4 bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-white/10">
              <User className="h-5 w-5 text-zinc-400" />
            </div>
            <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">Stranger</p>
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              {connected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Secure connection</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Negotiating signaling…</span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-white/5 text-zinc-300 hover:border-white/20 disabled:opacity-30 cursor-pointer"
            title="Request Video Call"
          >
            <Video className="h-4.5 w-4.5" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEnd}
            className="flex h-9 px-3 items-center justify-center gap-1.5 rounded-xl bg-red-500 text-white font-semibold text-xs hover:bg-red-400 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>Disconnect</span>
          </motion.button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto space-y-3">
            <div className="h-12 w-12 rounded-full bg-zinc-900/60 border border-white/5 flex items-center justify-center text-zinc-400">
              <MessageCircle className="h-6 w-6" />
            </div>
            <p className="font-semibold text-sm text-zinc-300">Start the conversation</p>
            <p className="text-xs text-zinc-500">
              Messages are routed strictly peer-to-peer over WebRTC. No data is stored.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-md leading-relaxed ${
                    m.mine
                      ? "bg-gradient-to-tr from-emerald-500 to-teal-500 text-zinc-950 font-medium rounded-tr-none"
                      : "bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none"
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Remote Typing Indicator */}
        <AnimatePresence>
          {remoteTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex justify-start items-center gap-2 mt-2"
            >
              <div className="bg-zinc-900 border border-white/5 text-zinc-400 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={endRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={submit} className="flex gap-2 border-t border-white/5 p-4 bg-zinc-900/20">
        <input
          value={draft}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={connected ? "Type a message…" : "Waiting for connection…"}
          disabled={!connected}
          className="flex-1 rounded-2xl bg-zinc-900 border border-white/5 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50"
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-2xl bg-emerald-400 hover:bg-emerald-300 transition text-zinc-950 font-bold px-4 py-3 flex items-center justify-center disabled:opacity-30 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </form>
    </motion.div>
  );
}
