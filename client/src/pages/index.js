"use client";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { IoMicOffOutline, IoMicOutline } from "react-icons/io5";
import { FaPhoneAlt } from "react-icons/fa";

const socket = io("http://localhost:5000");

export default function Home() {
  const [isWaiting, setIsWaiting] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [peerId, setPeerId] = useState(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescriptionSetRef = useRef(false);

  // Timer for ongoing call
  useEffect(() => {
    let interval;
    if (inCall) {
      interval = setInterval(() => setCallTime((t) => t + 1), 1000);
    } else {
      setCallTime(0);
    }
    return () => clearInterval(interval);
  }, [inCall]);

  // Setup socket listeners (runs once)
  useEffect(() => {
    socket.on("call_matched", ({ peerId: matchedPeerId, initiator }) => {
      console.log("Matched with:", matchedPeerId, "initiator:", initiator);
      setIsWaiting(false);
      setPeerId(matchedPeerId);
      // If initiator true -> create offer, otherwise wait for offer (or handle incoming offer event)
      startPeerConnection(initiator, matchedPeerId);
    });

    socket.on("offer", async ({ from, offer }) => {
      console.log("Received offer from:", from);
      setPeerId(from);
      // Start PC as callee and pass incoming offer
      await startPeerConnection(false, from, offer);
    });

    socket.on("answer", async ({ from, answer }) => {
      console.log("Received answer from:", from);
      try {
        if (!peerRef.current) {
          console.warn("No peer to set remote answer on");
          return;
        }
        // ensure we only call setRemoteDescription when we have a local offer
        // but if caller already created localOffer then this will succeed
        await peerRef.current.setRemoteDescription(answer);
        remoteDescriptionSetRef.current = true;

        // flush queued ICE candidates
        for (const c of pendingCandidatesRef.current) {
          try {
            await peerRef.current.addIceCandidate(c);
          } catch (err) {
            console.error("Error adding queued ICE candidate after answer", err);
          }
        }
        pendingCandidatesRef.current = [];
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice_candidate", async ({ from, candidate }) => {
      // incoming candidate from peer
      try {
        const rtcCandidate = new RTCIceCandidate(candidate);
        if (peerRef.current && peerRef.current.remoteDescription && peerRef.current.remoteDescription.type) {
          await peerRef.current.addIceCandidate(rtcCandidate);
        } else {
          // queue until remote description is set
          pendingCandidatesRef.current.push(rtcCandidate);
        }
      } catch (err) {
        console.error("Error processing incoming ICE candidate:", err);
      }
    });

    socket.on("end_call", () => {
      console.log("Call ended by peer");
      endCall();
    });

    return () => {
      // cleanup socket listeners when component unmounts
      socket.off("call_matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice_candidate");
      socket.off("end_call");
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPeerConnection = async (initiator, remotePeerId, incomingOffer) => {
    // If PC already exists but incomingOffer is provided (we're re-using), that's okay.
    try {
      if (!peerRef.current) {
        const peer = new RTCPeerConnection();

        // send ICE candidates to peer
        peer.onicecandidate = (event) => {
          if (event.candidate && remotePeerId) {
            socket.emit("ice_candidate", {
              peerId: remotePeerId,
              candidate: event.candidate,
            });
          }
        };

        // handle remote audio tracks
        peer.ontrack = (event) => {
          console.log("Remote track received");
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };

        // connection state changes
        peer.onconnectionstatechange = () => {
          console.log("Connection state:", peer.connectionState);
          if (peer.connectionState === "disconnected" || peer.connectionState === "failed" || peer.connectionState === "closed") {
            endCall();
          }
        };

        // get mic and add tracks
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peerRef.current = peer;
      }

      const peer = peerRef.current;

      if (initiator) {
        // caller: create offer and send it
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        // send the peer.localDescription (ensures type and sdp are correct)
        socket.emit("offer", { peerId: remotePeerId, offer: peer.localDescription });
      } else if (incomingOffer) {
        // callee: set remote offer, create & send answer
        await peer.setRemoteDescription(incomingOffer);
        // apply queued candidates (some browsers allow adding candidates before answer; still we'll queue them until remoteDesc set)
        remoteDescriptionSetRef.current = true;

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { peerId: remotePeerId, answer: peer.localDescription });

        // flush any queued remote ICE candidates
        for (const c of pendingCandidatesRef.current) {
          try {
            await peer.addIceCandidate(c);
          } catch (err) {
            console.error("Error adding queued ICE candidate (callee)", err);
          }
        }
        pendingCandidatesRef.current = [];
      }

      setInCall(true);
    } catch (err) {
      console.error("Error in startPeerConnection:", err);
      // cleanup if something went wrong
      endCall();
    }
  };

  const startCall = () => {
    socket.emit("start_call", { userId: `user-${socket.id}` });
    console.log(socket.id, "socket id");
    setIsWaiting(true);
  };

  const endCall = () => {
    if (peerId) socket.emit("end_call", { peerId });

    try {
      peerRef.current?.close();
    } catch (e) {
      console.warn("Error closing peer", e);
    }
    peerRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.warn("Error stopping local tracks", e);
    }
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;

    setInCall(false);
    setIsWaiting(false);
    setPeerId(null);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMuted((m) => !m);
    }
  };

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <main className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-4">
      {/* Landing Screen */}
      {!isWaiting && !inCall && (
        <div className="text-center space-y-6 animate-fadeIn">
          <h1 className="text-4xl font-bold">Random Voice Chat</h1>
          <p className="text-lg opacity-80">
            Connect instantly with a random person around the world
          </p>
          <button
            onClick={startCall}
            className="px-6 py-3 rounded-full bg-white text-purple-600 font-semibold shadow-lg hover:scale-105 transition"
          >
            Start Call
          </button>
        </div>
      )}

      {/* Waiting Screen */}
      {isWaiting && (
        <div className="flex flex-col items-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 border-4 border-white/50 border-t-white rounded-full animate-spin" />
          <p className="text-xl font-medium">Looking for a partner...</p>
          <p className="text-sm opacity-80">This may take a few seconds</p>
        </div>
      )}

      {/* In Call Screen */}
      {inCall && (
        <div className="flex flex-col items-center justify-between h-full py-12 w-full max-w-md animate-fadeIn">
          {/* Hidden remote audio player */}
          <audio ref={remoteAudioRef} autoPlay />

          {/* Avatars */}
          <div className="flex flex-col gap-8 items-center">
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold animate-pulse">
              You
            </div>
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold animate-pulse">
              User
            </div>
          </div>

          {/* Call Timer */}
          <div className="text-lg font-medium mt-4">{formatTime(callTime)}</div>

          {/* Controls */}
          <div className="flex gap-6 mt-6">
            <button
              onClick={toggleMute}
              className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              {muted ? (
                <IoMicOffOutline className="w-6 h-6" />
              ) : (
                <IoMicOutline className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition"
            >
              <FaPhoneAlt className="w-6 h-6 rotate-135" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
