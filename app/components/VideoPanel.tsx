"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Maximize, Minimize, PhoneOff, UserMinus } from "lucide-react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setVideoMuted(!videoMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-40 flex flex-col bg-zinc-950 overflow-hidden">
      <div className="relative flex-1 bg-zinc-950 flex items-center justify-center">
        {/* Remote full-screen video */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />

        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-zinc-400 space-y-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10 text-emerald-400">
              <Video className="h-6 w-6 animate-pulse" />
              <span className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping opacity-60" />
            </div>
            <p className="text-sm font-semibold tracking-wide animate-pulse">
              Waiting for stranger&rsquo;s video stream…
            </p>
          </div>
        )}

        {/* Local draggable Picture-in-Picture video */}
        {localStream && (
          <motion.div
            drag
            dragConstraints={containerRef}
            dragElastic={0.1}
            whileDrag={{ scale: 1.05 }}
            className="absolute bottom-6 right-6 z-50 h-44 w-32 rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing"
          >
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {videoMuted && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-zinc-500">
                <VideoOff className="h-6 w-6" />
              </div>
            )}
          </motion.div>
        )}

        {/* Floating Premium controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-zinc-900/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 shadow-2xl">
          {/* Audio toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleAudio}
            className={`p-3 rounded-2xl transition cursor-pointer ${audioMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-zinc-800 text-zinc-200 border border-white/5"}`}
          >
            {audioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </motion.button>

          {/* Video toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            className={`p-3 rounded-2xl transition cursor-pointer ${videoMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-zinc-800 text-zinc-200 border border-white/5"}`}
          >
            {videoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </motion.button>

          {/* Fullscreen toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-zinc-800 text-zinc-200 border border-white/5 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </motion.button>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-white/10" />

          {/* End video call */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEnd}
            className="p-3.5 rounded-2xl bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400 transition cursor-pointer"
          >
            <PhoneOff className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
