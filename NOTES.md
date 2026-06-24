# Pulse — Technical Assessment Notes

## Phase 1 — Make it run (Bugs Fixed)

1. **Stuck Presence/Stale Users Bug (`app/api/poll/route.ts`)**:
   - **What was broken**: Polling heartbeats updated *all* presence records (`where: {}` in Prisma `updateMany`) instead of just the polling user's. Thus, all stale users were kept alive indefinitely.
   - **How it was found**: Checked why users remained on the map after closing the page. Inspected the database update query.
   - **How it was fixed**: Restricted the heartbeat update condition to `{ id }`.

2. **WebRTC Active Connection Teardown Bug (`app/page.tsx`)**:
   - **What was broken**: Closing a tab did not immediately notify/disconnect the peer from the active connection.
   - **How it was found**: Code inspection of the polling routine in `app/page.tsx`.
   - **How it was fixed**: Added a check during active connections to verify the peer is still online in the list of polled users, triggering client teardown if they disappear.

3. **Active signaling busy state hang (`app/api/signal/route.ts`)**:
   - **What was broken**: If a call ended or was declined, users remained marked as `busy: true` in the DB because `end` signals didn't reset the busy state (only `decline` did).
   - **How it was fixed**: Updated signaling logic to set `busy: false` in the database when delivering `end` signals.

4. **WebRTC Chat Message Type Mismatch (`lib/webrtc.ts`)**:
   - **What was broken**: Send function transmitted `{ t: "msg" }` but the receiving channel listener checked for `{ t: "chat" }`.
   - **How it was fixed**: Changed the transmitted control packet type to `{ t: "chat" }`.

5. **ICE Candidates negotiation race condition (`lib/webrtc.ts`)**:
   - **What was broken**: ICE candidates were processed before `setRemoteDescription` was complete, causing WebRTC setup to fail intermittently.
   - **How it was fixed**: Implemented an ICE candidate queueing system that flushes candidates only after the remote description is successfully applied.

---

## Phase 2 — Make it good (Visual Redesign)

1. **Dark Theme & Glassmorphism**:
   - Redesigned the visual system from scratch using a modern sleek dark mode palette, smooth gradients, and glassmorphism.
   - Added glowing radial ambient backdrops and premium border styles.

2. **Framer Motion Micro-Animations**:
   - Animated the entry transition of components.
   - Integrated typing indicator start/stop events over WebRTC and displayed a bouncing typing indicator in chat bubbles.
   - Designed a draggable PiP video window with smooth scale transitions on exit.

3. **Interactive Map Enhancements**:
   - Configured custom interactive dots with custom CSS animations rather than plain emoji/text overlays.
   - Added map ease-to/fly-to transitions focusing on peers when clicked.

4. **Connection Prompts & Geocoding**:
   - Built a beautiful full-screen modal showing the distance in kilometers between peers using the Haversine formula.
   - Integrated reverse geocoding on the client-side using `bigdatacloud` to fetch and display the country of the incoming connection request.

---

## Phase 3 — Make it secure (Security Hardening)

1. **Input Validation**:
   - Installed `zod` and created strict schemas for coordinates boundaries (lat `[-90, 90]`, lng `[-180, 180]`), sessions, and WebRTC signal payloads to guard against coordinate injection or buffer overflows.

2. **Rate Limiting**:
   - Implemented an in-memory sliding window rate limiter (`lib/limiter.ts`) that protects `/api/join`, `/api/poll`, and `/api/signal` endpoints based on client IP.

3. **WebRTC Signaling Verification**:
   - Hardened `/api/signal/route.ts` so that signalling handshakes only succeed between active peers registered in the database, preventing unauthorized users from sniffing or injecting signaling packets.

4. **Message Sanitization**:
   - Utilized `dompurify` to strip out arbitrary HTML/scripts in messages both on transmission and display to protect against P2P Cross-Site Scripting (XSS).

6. **Self-Healing Busy State Sync (`app/api/poll/route.ts` & `app/page.tsx`)**:
   - **What was broken**: When a peer disconnected abruptly or had a network failure, they could remain stuck as `busy: true` in the database. Any future incoming connection requests were auto-declined on the server.
   - **How it was fixed**: Extended the `/api/poll` endpoint to accept a `busy` query parameter. The client now sends its exact connection state (busy or not) during the 1.5-second heartbeat ticks, which corrects any database state desync within 1.5 seconds.

7. **Generous Local-Testing Rate Limits (`lib/limiter.ts`)**:
   - **What was broken**: The WebRTC signaling endpoint was rate-limited to 100 requests per minute per IP. Since WebRTC sends a signal for every ICE candidate generated, testing with two tabs on the same machine/IP would frequently hit the limit and drop candidates (status 429), failing the peer connection.
   - **How it was fixed**: Raised the signal limit to 500/min and the poll limit to 300/min to accommodate multi-tab local development and multi-candidate SDP negotiation.

8. **Crypto randomUUID Safe Fallback (`app/page.tsx`)**:
   - **What was broken**: The app used browser-native `crypto.randomUUID()` directly. In non-secure contexts (such as connecting to local IP like `http://192.168.1.15:3000` from a mobile phone or another computer), this function is undefined and would crash the app.
   - **How it was fixed**: Replaced it with a safe fallback UUID generator that falls back to a math-based generator if native `crypto.randomUUID` is unavailable.

---

## Phase 4 — Make it better (Creative Features)

1. **Dynamic Mood/Status Selector**:
   - Added an interactive selector in the entry gate allowing users to set a "vibe" emoji (e.g., 🚀 Coding, 🎧 Music, 💬 Chatting).
   - Saved the mood in the database and rendered it directly above map dots on the Mapbox interface using a bouncing element.

2. **Global Activity & Mood Dashboard**:
   - Created a glassmorphic top-right dashboard widget displaying total worldwide strangers online, available peers, and a breakdown of dominant mood statistics to make the app feel alive and populated.

3. **Stranger Icebreakers**:
   - Implemented a floating "Icebreaker" widget at the top of empty chat windows showing fun conversation starters, with shuffle capabilities and a one-click button to pre-fill the chat input.

4. **Interest Matching & Quick Match**:
   - Allowed users to select multiple interest tags (e.g., Music, Sports, Tech) during onboarding.
   - Highlights peers with matching interests on the map using a distinct glowing green border.
   - Introduced a **"Quick Match"** dashboard trigger that searches for active online peers with overlapping interests and automatically requests a connection.

5. **Map Connection Trace Layer**:
   - Integrated a Mapbox GeoJSON LineString source and animated connection trace layer that dynamically draws a glowing line connecting Point A to Point B on the map upon successful peer match, showing user connectivity visually.

### Next Steps with More Time:
- **STUN/TURN Servers**: Deploy a custom coturn server to enable connections on strict corporate networks.
- **Persistent Mood/Interest Updates**: Allow active users to update their vibe or interest list directly from the live map dashboard without re-joining.
