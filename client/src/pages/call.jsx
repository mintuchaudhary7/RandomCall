"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

export default function CallPage() {
  const remoteAudioRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationRef = useRef(null);

  const [isWaiting, setIsWaiting] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [peerId, setPeerId] = useState(null);
  const [isCaller, setIsCaller] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    socket.on("call_matched", ({ peerId }) => {
      setIsWaiting(false);
      setPeerId(peerId);

      if (!peerRef.current) {
        setIsCaller(true);
        startPeerConnection(true, peerId);
      }
    });

    socket.on("offer", async ({ from, offer }) => {
      setPeerId(from);
      setIsCaller(false);
      await startPeerConnection(false, from, offer);
    });

    socket.on("answer", async ({ answer }) => {
      if (peerRef.current && peerRef.current.signalingState === "have-local-offer") {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        // Add queued ICE candidates
        for (const c of pendingCandidatesRef.current) {
          await peerRef.current.addIceCandidate(c);
        }
        pendingCandidatesRef.current = [];
      }
    });

    socket.on("ice_candidate", async ({ candidate }) => {
      const rtcCandidate = new RTCIceCandidate(candidate);
      if (peerRef.current && peerRef.current.remoteDescription) {
        await peerRef.current.addIceCandidate(rtcCandidate);
      } else {
        pendingCandidatesRef.current.push(rtcCandidate);
      }
    });

    socket.on("end_call", () => {
      endCall();
    });

    return () => socket.disconnect();
  }, []);

  const startPeerConnection = async (caller, remotePeerId, incomingOffer) => {
    if (!peerRef.current) {
      const peer = new RTCPeerConnection();

      // ICE
      peer.onicecandidate = (event) => {
        if (event.candidate && remotePeerId) {
          socket.emit("ice_candidate", { peerId: remotePeerId, candidate: event.candidate });
        }
      };

      // Remote audio
      peer.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => console.log("User gesture needed to play audio"));
        }
      };

      // Local audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      setupMicLevel(stream);

      peerRef.current = peer;
    }

    const peer = peerRef.current;

    if (caller) {
      if (!peer.localDescription) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", { peerId: remotePeerId, offer });
      }
    } else if (incomingOffer) {
      await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("answer", { peerId: remotePeerId, answer });
    }

    setInCall(true);
  };

  const setupMicLevel = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    const updateMicLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const level = sum / dataArray.length / 128; // normalized 0-1
      setMicLevel(level);
      animationRef.current = requestAnimationFrame(updateMicLevel);
    };
    updateMicLevel();
  };

  const startCall = () => {
    socket.emit("start_call", { userId: `user-${socket.id}` });
    setIsWaiting(true);
  };

  const endCall = () => {
    if (peerId) socket.emit("end_call", { peerId });

    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setMicLevel(0);

    setInCall(false);
    setIsWaiting(false);
    setPeerId(null);
    setIsCaller(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Voice Call MVP</h1>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {isWaiting && <p className="text-gray-600">⏳ Waiting for another user...</p>}
      {inCall && (
        <p className="text-green-600">
          🎤 You are in a call{" "}
          <span
            style={{
              display: "inline-block",
              width: `${Math.min(micLevel * 50, 50)}px`,
              height: "10px",
              backgroundColor: "limegreen",
              marginLeft: "10px",
              borderRadius: "5px",
              transition: "width 0.1s",
            }}
          />
        </p>
      )}

      <div className="flex gap-3 mt-4">
        {!inCall && !isWaiting && (
          <button onClick={startCall} className="px-4 py-2 bg-green-600 text-white rounded-md">
            Start Call
          </button>
        )}
        {inCall && (
          <button onClick={endCall} className="px-4 py-2 bg-red-600 text-white rounded-md">
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
