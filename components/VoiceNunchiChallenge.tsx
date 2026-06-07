"use client";

import { useEffect, useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";
import type { VoiceData } from "@/lib/types";

interface Props {
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

type RecordingState = "idle" | "recording" | "ready";

export default function VoiceNunchiChallenge({ telemetry, onComplete }: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>(
    Array.from({ length: 18 }, () => 0.08)
  );
  const voiceDataRef = useRef<VoiceData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const samplesRef = useRef<{ t: number; rms: number; db: number }[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => stopTracks();
  }, []);

  const stopTracks = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    animationRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  };

  const startRecording = async () => {
    setError("");
    telemetry.onPointerMove();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("현재 브라우저에서는 마이크를 사용할 수 없습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) {
        setError("현재 브라우저에서는 마이크 소리 측정을 사용할 수 없습니다.");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      samplesRef.current = [];
      startedAtRef.current = Date.now();
      setLevel(0);
      setLevelHistory(Array.from({ length: 18 }, () => 0.08));
      setState("recording");

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const centered = (value - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length);
        const db = 20 * Math.log10(Math.max(rms, 0.00001));
        const normalized = Math.min(1, Math.max(0, (db + 60) / 45));
        samplesRef.current.push({
          t: Date.now() - startedAtRef.current,
          rms,
          db,
        });
        if (samplesRef.current.length > 120) samplesRef.current.shift();
        setLevel(normalized);
        setLevelHistory((history) => [...history.slice(1), Math.max(0.08, normalized)]);
        animationRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      setError("마이크 권한을 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  };

  const stopRecording = () => {
    if (state !== "recording") return;
    telemetry.onPointerMove();

    const endedAt = Date.now();
    const samples = samplesRef.current;
    const dbValues = samples.map((sample) => sample.db);
    const peakDb = dbValues.length ? Math.max(...dbValues) : -100;
    const averageDb = dbValues.length
      ? dbValues.reduce((sum, value) => sum + value, 0) / dbValues.length
      : -100;

    voiceDataRef.current = {
      permissionGranted: true,
      recordingStartedAt: startedAtRef.current,
      recordingEndedAt: endedAt,
      durationMs: endedAt - startedAtRef.current,
      samples,
      peakDb,
      averageDb,
      loudSampleCount: dbValues.filter((db) => db > -16).length,
      quietSampleCount: dbValues.filter((db) => db < -42).length,
    };

    stopTracks();
    setState("ready");
  };

  const handleSubmit = () => {
    if (!voiceDataRef.current) return;
    onComplete({
      answer: "voice-recorded",
      voiceData: voiceDataRef.current,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-7">
        <p className="text-sm font-medium leading-6 text-neutral-500">
          마이크 버튼을 켜고 '눈치게임 1'이라고 외쳐주세요.
        </p>

        <div className="relative flex h-28 w-28 items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full transition-all ${
              state === "recording" ? "bg-blue-100" : "bg-white"
            }`}
            style={{ transform: `scale(${1 + level * 0.12})` }}
          />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
            <div className="relative h-11 w-7 rounded-full bg-blue-600">
              <div className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
              <div className="absolute -bottom-4 left-1/2 h-4 w-0.5 -translate-x-1/2 bg-blue-600" />
              <div className="absolute -bottom-4 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-600" />
            </div>
          </div>
        </div>

        <div className="flex h-28 w-full max-w-sm items-end justify-center gap-1.5 rounded-lg bg-white px-4 py-4 shadow-inner">
          {levelHistory.map((value, index) => (
            <div
              key={index}
              className={`w-2.5 rounded-full transition-all duration-100 ${
                state === "recording" ? "bg-blue-600" : "bg-neutral-300"
              }`}
              style={{
                height: `${Math.max(10, value * 92)}px`,
                opacity: state === "recording" ? 0.45 + value * 0.55 : 0.45,
              }}
            />
          ))}
        </div>

        <p className="text-sm font-medium text-neutral-500">
          {state === "recording"
            ? "소리 크기를 측정하고 있습니다."
            : state === "ready"
              ? "녹음이 기록되었습니다."
              : "마이크를 켜면 소리 크기만 측정합니다."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {state === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
          >
            마이크 켜기
          </button>
        )}
        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-lg bg-red-600 px-8 py-3 text-base font-semibold text-white hover:bg-red-700"
          >
            녹음 멈추기
          </button>
        )}
        {state === "ready" && (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="rounded-lg border border-neutral-300 px-8 py-3 text-base font-semibold text-neutral-700 hover:border-neutral-400"
            >
              다시 녹음
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
            >
              {UI.submit}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-neutral-500">
        음성 파일은 저장하지 않고, 소리 크기 변화만 기록합니다.
      </p>
    </div>
  );
}
