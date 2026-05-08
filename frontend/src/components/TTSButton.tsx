import { useState, useRef } from "react";

interface TTSButtonProps {
  text: string;
  tone: string;
}

export function TTSButton({ text, tone }: TTSButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async () => {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8011/api/tts/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, tone }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => { setState("idle"); URL.revokeObjectURL(url); };
      audio.onerror = () => setState("idle");

      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  };

  const isLoading = state === "loading";
  const isPlaying = state === "playing";

  return (
    <button
      onClick={handleClick}
      title={isPlaying ? "Durdur" : "Sesli oku"}
      style={{
        width: 28, height: 28, borderRadius: "50%",
        border: `1px solid ${isPlaying ? "#f97316" : "#fed7aa"}`,
        background: isPlaying ? "#fff7ed" : "transparent",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      {isLoading ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
          </path>
        </svg>
      ) : isPlaying ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#f97316">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
