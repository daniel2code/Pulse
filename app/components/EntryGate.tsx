"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, MapPin, AlertCircle, Globe } from "lucide-react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#030303] p-6 text-zinc-100 overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md glass-panel rounded-3xl p-8 text-center"
      >
        {/* Globe Header Icon */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6"
        >
          <Globe className="h-8 w-8" />
        </motion.div>

        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
          Pulse
        </h1>
        <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
          A living globe of anonymous strangers. Drop onto the map, locate yourself, and connect instantly.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={enter}
            disabled={status === "locating"}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 px-6 font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 cursor-pointer"
          >
            {status === "locating" ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Compass className="h-5 w-5" />
                </motion.div>
                <span>Locating…</span>
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                <span>Enter Pulse</span>
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-left text-sm text-red-400"
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 border-t border-zinc-800/60 pt-6 text-xs text-zinc-500 space-y-2">
          <p>🔒 No accounts. No logs. Your chats and calls are strictly peer-to-peer.</p>
          <p>📍 Location is randomized by 1–3 km for complete privacy.</p>
        </div>
      </motion.div>
    </div>
  );
}
