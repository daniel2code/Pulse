"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, MapPin, Check, X, Navigation } from "lucide-react";

// Haversine distance helper
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
  myCoords,
  peerCoords,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
  myCoords?: { lat: number; lng: number } | null;
  peerCoords?: { lat: number; lng: number } | null;
}) {
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!peerCoords) return;
    setLoading(true);
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${peerCoords.lat}&longitude=${peerCoords.lng}&localityLanguage=en`
    )
      .then((res) => res.json())
      .then((data) => {
        setCountry(data.countryName || data.continent || "Unknown location");
      })
      .catch(() => {
        setCountry("Global participant");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [peerCoords]);

  const distance =
    myCoords && peerCoords
      ? getDistance(myCoords.lat, myCoords.lng, peerCoords.lat, peerCoords.lng)
      : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-3xl glass-panel p-6 text-center text-zinc-100 border border-white/10"
      >
        {/* Animated radar/globe header */}
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-5">
          <Globe className="h-6 w-6 animate-pulse" />
          <span className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping opacity-60" />
        </div>

        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
          {title}
        </h2>
        
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}

        {/* Location & Distance indicators */}
        {(distance !== null || country || loading) && (
          <div className="mt-5 mb-2 p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2 text-left text-sm text-zinc-300">
            {loading ? (
              <div className="flex items-center gap-2 text-zinc-500 justify-center py-2">
                <Navigation className="h-4 w-4 animate-spin" />
                <span>Geocoding coordinates…</span>
              </div>
            ) : (
              <>
                {country && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Location: <span className="font-semibold text-zinc-100">{country}</span></span>
                  </div>
                )}
                {distance !== null && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-teal-400 shrink-0" />
                    <span>Distance: <span className="font-semibold text-zinc-100">{distance.toLocaleString()} km away</span></span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>{declineLabel}</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-300 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>{acceptLabel}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
