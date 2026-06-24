"use client";

import { motion } from "framer-motion";
import { Users, Activity, Heart, Globe } from "lucide-react";
import type { PeerDot } from "@/lib/types";

interface DashboardWidgetProps {
  peers: PeerDot[];
  selfMood: string | null;
}

export default function DashboardWidget({ peers, selfMood }: DashboardWidgetProps) {
  const totalOnline = peers.length + 1;

  // Aggregate moods
  const moodCounts: Record<string, number> = {};
  if (selfMood) {
    moodCounts[selfMood] = 1;
  }
  peers.forEach((p) => {
    if (p.mood) {
      moodCounts[p.mood] = (moodCounts[p.mood] || 0) + 1;
    }
  });

  const moodsList = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-6 right-6 z-10 w-72 glass-panel rounded-2xl p-4 text-zinc-100 shadow-xl border border-zinc-800/80 pointer-events-auto select-none"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
          <span className="text-sm font-bold tracking-tight text-zinc-200">Global Activity</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-400">{totalOnline} Online</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Mood Distribution */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
            Current Vibes
          </span>
          {moodsList.length === 0 ? (
            <div className="text-xs text-zinc-500 italic py-1">No vibes set yet</div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {moodsList.map(([emoji, count]) => (
                <div
                  key={emoji}
                  className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/60 px-2 py-1 rounded-lg text-xs"
                >
                  <span>{emoji}</span>
                  <span className="text-zinc-500 font-medium">×</span>
                  <span className="text-zinc-300 font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Connection Health */}
        <div className="border-t border-zinc-800/30 pt-2.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-zinc-500" />
              <span>Map Coverage</span>
            </span>
            <span className="text-zinc-300 font-mono font-medium">Worldwide</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mt-1.5">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              <span>Available Strangers</span>
            </span>
            <span className="text-emerald-400 font-mono font-medium">{peers.filter(p => !p.busy).length}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
