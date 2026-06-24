"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "pk.eyJ1IjoicHVsc2UtbWFwIiwiYSI6ImNrMDBkZW1vMDAwMDAwMDAifQ.AAAAAAAAAAAAAAAAAAAAAA";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 75%, 55%)`;
}

/**
 * Groups peers within CLUSTER_THRESHOLD degrees of each other, then fans them
 * out in a small arc so co-located users remain individually visible/tappable.
 */
const CLUSTER_THRESHOLD = 0.008; // ~900 m — treat anything closer as same spot
const FAN_RADIUS = 0.006;        // degrees to spread each dot (~700 m)

function computeDisplayPositions(
  peers: PeerDot[],
): Map<string, { lat: number; lng: number; clusterSize: number }> {
  const result = new Map<string, { lat: number; lng: number; clusterSize: number }>();
  const assigned = new Set<string>();

  for (let i = 0; i < peers.length; i++) {
    if (assigned.has(peers[i].id)) continue;
    const cluster: PeerDot[] = [peers[i]];
    for (let j = i + 1; j < peers.length; j++) {
      if (assigned.has(peers[j].id)) continue;
      const dLat = Math.abs(peers[i].lat - peers[j].lat);
      const dLng = Math.abs(peers[i].lng - peers[j].lng);
      if (dLat <= CLUSTER_THRESHOLD && dLng <= CLUSTER_THRESHOLD) {
        cluster.push(peers[j]);
      }
    }
    cluster.forEach((p) => assigned.add(p.id));

    if (cluster.length === 1) {
      result.set(cluster[0].id, { lat: cluster[0].lat, lng: cluster[0].lng, clusterSize: 1 });
    } else {
      // Fan out evenly around the centroid in a small circle
      const centLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
      const centLng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
      cluster.forEach((p, idx) => {
        const angle = (2 * Math.PI * idx) / cluster.length - Math.PI / 2;
        result.set(p.id, {
          lat: centLat + FAN_RADIUS * Math.sin(angle),
          lng: centLng + FAN_RADIUS * Math.cos(angle),
          clusterSize: cluster.length,
        });
      });
    }
  }

  return result;
}

export default function WorldMap({
  peers,
  me,
  myMood,
  myInterests,
  connectedPeerCoords,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  myMood: string | null;
  myInterests: string | null;
  connectedPeerCoords: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialize map
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 3.5 : 1.5,
        attributionControl: false,
      });

      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set own marker & center map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `<span class="pulse-me-label">You (Here)</span>`;
        if (myMood) {
          el.innerHTML += `<span class="pulse-mood-emoji absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md shadow-black/50">${myMood}</span>`;
        }
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);

        // Smooth transition to user's location
        map.flyTo({
          center: [me.lng, me.lat],
          zoom: 4.5,
          speed: 1.2,
          essential: true,
        });
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
        const el = meMarkerRef.current.getElement();
        const existingMoodBadge = el.querySelector(".pulse-mood-emoji");
        if (myMood) {
          if (!existingMoodBadge) {
            el.innerHTML += `<span class="pulse-mood-emoji absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md shadow-black/50">${myMood}</span>`;
          } else if (existingMoodBadge.textContent !== myMood) {
            existingMoodBadge.textContent = myMood;
          }
        } else if (existingMoodBadge) {
          existingMoodBadge.remove();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready, myMood]);

  // Synchronize peer markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      // Compute display positions — fans out co-located peers so they're each tappable
      const displayPositions = computeDisplayPositions(peers);

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);

        const display = displayPositions.get(peer.id) ?? { lat: peer.lat, lng: peer.lng, clusterSize: 1 };
        const isInCluster = display.clusterSize > 1;

        let sharesInterest = false;
        if (myInterests && peer.interests) {
          const myTags = myInterests.split(",").map((t) => t.trim().toLowerCase());
          const peerTags = peer.interests.split(",").map((t) => t.trim().toLowerCase());
          sharesInterest = myTags.some((t) => peerTags.includes(t));
        }

        let tooltipText = isInCluster
          ? `One of ${display.clusterSize} people nearby — tap to connect`
          : "Tap to connect";
        if (peer.interests) {
          tooltipText += ` | Interests: ${peer.interests}`;
        }

        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.color = dotColor(peer.id);
          el.style.background = dotColor(peer.id);
          el.title = tooltipText;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) {
              onPeerClickRef.current(peer.id);
              // Focus map on the peer's real (unfanned) position
              map.easeTo({
                center: [peer.lng, peer.lat],
                zoom: Math.max(map.getZoom(), 5.5),
                duration: 800,
              });
            }
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([display.lng, display.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else {
          // Update position if fan assignment changed
          marker.setLngLat([display.lng, display.lat]);
        }

        const el = marker.getElement();
        el.title = tooltipText;
        el.style.opacity = peer.busy ? "0.3" : "1";
        el.style.cursor = peer.busy || !canConnectRef.current ? "not-allowed" : "pointer";

        // Cluster badge: show "×N" corner badge when co-located
        const existingClusterBadge = el.querySelector(".pulse-cluster-badge");
        if (isInCluster) {
          if (!existingClusterBadge) {
            const badge = document.createElement("span");
            badge.className = "pulse-cluster-badge absolute -bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-full px-1 text-[9px] font-bold leading-4 whitespace-nowrap pointer-events-none shadow-sm";
            badge.textContent = `×${display.clusterSize} here`;
            el.appendChild(badge);
          } else {
            existingClusterBadge.textContent = `×${display.clusterSize} here`;
          }
        } else if (existingClusterBadge) {
          existingClusterBadge.remove();
        }

        // Interest match glow
        if (sharesInterest) {
          el.style.boxShadow = "0 0 14px #10b981, inset 0 0 4px #10b981";
          el.style.borderWidth = "2px";
          el.style.borderColor = "#34d399";
        } else {
          el.style.boxShadow = "";
          el.style.borderWidth = "";
          el.style.borderColor = "";
        }

        // Mood emoji badge
        const existingMoodBadge = el.querySelector(".pulse-mood-emoji");
        if (peer.mood) {
          if (!existingMoodBadge) {
            const badge = document.createElement("span");
            badge.className = "pulse-mood-emoji absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md shadow-black/50 hover:scale-110 transition-transform pointer-events-none";
            badge.textContent = peer.mood;
            el.appendChild(badge);
          } else if (existingMoodBadge.textContent !== peer.mood) {
            existingMoodBadge.textContent = peer.mood;
          }
        } else if (existingMoodBadge) {
          existingMoodBadge.remove();
        }
      }

      // Remove stale markers
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready, myInterests]);

  // Connection Line rendering
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const sourceId = "connection-line-source";
    const layerId = "connection-line-layer";

    if (me && connectedPeerCoords) {
      const geojson = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [me.lng, me.lat],
            [connectedPeerCoords.lng, connectedPeerCoords.lat],
          ],
        },
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as any).setData(geojson);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: geojson as any,
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#10b981",
            "line-width": 3,
            "line-blur": 1,
            "line-opacity": 0.85,
          },
        });
      }
    } else {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }, [me, connectedPeerCoords, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[#030303]" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-10 bg-[#030303]/90">
          <p className="max-w-md rounded-2xl glass-panel p-6 text-sm text-zinc-300">
            Set <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your <code>.env</code> file to load the world map.
          </p>
        </div>
      )}

      {/* Online count badge */}
      <div className="absolute bottom-6 left-6 rounded-2xl glass-panel px-4 py-2 text-xs font-medium text-zinc-300 flex items-center gap-2 border border-white/5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{peers.length} active strangers</span>
      </div>
    </div>
  );
}
