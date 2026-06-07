"use client";

import { useEffect, useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";
import type { DragMotionData, MotionSample } from "@/lib/types";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

type MotionMode = "checking" | "permission" | "sensor-motion" | "drag-fallback";
type Direction = "up" | "down" | null;

const SENSOR_PROBE_TIMEOUT_MS = 1800;
const MAX_SENSOR_SAMPLES = 240;
const MAX_DRAG_POINTS = 500;

export default function DeviceMotionChallenge({ config, telemetry, onComplete }: Props) {
  const required = (config.requiredMovements as number) ?? 3;
  const [mode, setMode] = useState<MotionMode>("checking");
  const [moveCount, setMoveCount] = useState(0);
  const [dragY, setDragY] = useState(50);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const modeRef = useRef<MotionMode>("checking");
  const samplesRef = useRef<MotionSample[]>([]);
  const completedRef = useRef(false);
  const lastSensorDirectionRef = useRef<Direction>(null);
  const lastSensorTurnRef = useRef(0);
  const sensorTurnsRef = useRef(0);

  const dragActiveRef = useRef(false);
  const dragStartRef = useRef(0);
  const dragEndRef = useRef<number | undefined>(undefined);
  const dragPathRef = useRef<DragMotionData["path"]>([]);
  const objectRectRef = useRef<DOMRect | null>(null);
  const lastDragDirectionRef = useRef<Direction>(null);
  const lastDragTurnRef = useRef(0);
  const dragTurnsRef = useRef(0);
  const pointerLeftObjectRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const switchMode = (nextMode: MotionMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  const submitSensorMotion = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsComplete(true);
    setTimeout(() => {
      onComplete({
        answer: "sensor-motion",
        motionMode: "sensor-motion",
        motionSamples: samplesRef.current,
      });
    }, 800);
  };

  const submitDragFallback = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsComplete(true);
    dragEndRef.current = Date.now();
    setTimeout(() => {
      onComplete({
        answer: "drag-fallback",
        motionMode: "drag-fallback",
        dragMotionData: buildDragMotionData(),
      });
    }, 800);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | undefined;
    let cancelled = false;

    const useFallback = (message = UI.motionSensorUnavailable) => {
      if (cancelled || completedRef.current) return;
      setFallbackReason(message);
      switchMode("drag-fallback");
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      const rotation = event.rotationRate;
      const hasSensorData =
        acc?.x != null ||
        acc?.y != null ||
        acc?.z != null ||
        rotation?.alpha != null ||
        rotation?.beta != null ||
        rotation?.gamma != null;

      if (!hasSensorData) return;

      if (modeRef.current === "checking" || modeRef.current === "permission") {
        switchMode("sensor-motion");
      }

      if (modeRef.current !== "sensor-motion") return;

      const sample: MotionSample = {
        x: acc?.x ?? 0,
        y: acc?.y ?? 0,
        z: acc?.z ?? 0,
        alpha: rotation?.alpha ?? undefined,
        beta: rotation?.beta ?? undefined,
        gamma: rotation?.gamma ?? undefined,
        t: Date.now(),
      };

      samplesRef.current.push(sample);
      if (samplesRef.current.length > MAX_SENSOR_SAMPLES) samplesRef.current.shift();

      const verticalSignal = sample.y + (sample.beta ?? 0) * 0.03;
      const direction = verticalSignal > 1.2 ? "down" : verticalSignal < -1.2 ? "up" : null;
      const now = Date.now();

      if (
        direction &&
        lastSensorDirectionRef.current &&
        direction !== lastSensorDirectionRef.current &&
        now - lastSensorTurnRef.current > 220
      ) {
        lastSensorTurnRef.current = now;
        sensorTurnsRef.current += 1;
        const nextCount = Math.min(required, Math.floor(sensorTurnsRef.current / 2));
        setMoveCount(nextCount);
        if (nextCount >= required) submitSensorMotion();
      }

      if (direction) lastSensorDirectionRef.current = direction;
    };

    async function probeMotionSensor() {
      const motionCtor = (window as Window & {
        DeviceMotionEvent?: typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<"granted" | "denied" | "default">;
        };
      }).DeviceMotionEvent;

      if (!motionCtor) {
        useFallback();
        return;
      }

      try {
        if (typeof motionCtor.requestPermission === "function") {
          switchMode("permission");
          const permission = await motionCtor.requestPermission();
          if (permission !== "granted") {
            useFallback();
            return;
          }
        }
      } catch {
        useFallback();
        return;
      }

      window.addEventListener("devicemotion", handleMotion);
      timeoutId = window.setTimeout(() => {
        if (samplesRef.current.length === 0) useFallback();
      }, SENSOR_PROBE_TIMEOUT_MS);
    }

    probeMotionSensor();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [required, onComplete]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (completedRef.current) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    telemetry.onPointerMove();
    dragActiveRef.current = true;
    activePointerIdRef.current = event.pointerId;
    dragStartRef.current = Date.now();
    dragEndRef.current = undefined;
    dragPathRef.current = [];
    objectRectRef.current = target.getBoundingClientRect();
    lastDragDirectionRef.current = null;
    lastDragTurnRef.current = 0;
    dragTurnsRef.current = 0;
    pointerLeftObjectRef.current = false;
    setMoveCount(0);
    recordDragPoint(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current || activePointerIdRef.current !== event.pointerId) return;
    telemetry.onPointerMove();
    recordDragPoint(event.clientX, event.clientY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    dragActiveRef.current = false;
    dragEndRef.current = Date.now();
  };

  const recordDragPoint = (clientX: number, clientY: number) => {
    const rect = objectRectRef.current;
    if (!rect) return;

    const stage = rectToStage(rect);
    const pct = ((clientY - stage.top) / stage.height) * 100;
    const clamped = Math.max(8, Math.min(92, pct));
    setDragY(clamped);

    const insideObject =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!insideObject) pointerLeftObjectRef.current = true;

    dragPathRef.current.push({ x: clientX, y: clientY, t: Date.now(), insideObject });
    if (dragPathRef.current.length > MAX_DRAG_POINTS) dragPathRef.current.shift();

    const direction = clamped > 60 ? "down" : clamped < 40 ? "up" : null;
    const now = Date.now();

    if (
      direction &&
      lastDragDirectionRef.current &&
      direction !== lastDragDirectionRef.current &&
      now - lastDragTurnRef.current > 180
    ) {
      lastDragTurnRef.current = now;
      dragTurnsRef.current += 1;
      const nextCount = Math.min(required, Math.floor(dragTurnsRef.current / 2));
      setMoveCount(nextCount);
      if (nextCount >= required) submitDragFallback();
    }

    if (direction) lastDragDirectionRef.current = direction;
  };

  const buildDragMotionData = (): DragMotionData => {
    const path = dragPathRef.current;
    const speeds: number[] = [];
    let pauses = 0;

    for (let i = 1; i < path.length; i++) {
      const dt = path[i].t - path[i - 1].t;
      const distance = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (dt > 0) speeds.push(distance / dt);
      if (dt > 140) pauses += 1;
    }

    return {
      pointerDownTime: dragStartRef.current,
      pointerUpTime: dragEndRef.current,
      pointerMoveCount: Math.max(0, path.length - 1),
      totalDragDurationMs: (dragEndRef.current ?? Date.now()) - dragStartRef.current,
      path,
      directionChanges: dragTurnsRef.current,
      approximateCycles: Math.floor(dragTurnsRef.current / 2),
      speedVariation: variationCoefficient(speeds),
      pauses,
      pointerLeftObject: pointerLeftObjectRef.current,
    };
  };

  if (mode === "checking" || mode === "permission") {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
        <p>{mode === "permission" ? UI.motionPermission : UI.detectingDevice}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {mode === "sensor-motion" ? (
        <div className="text-center">
          <p className="text-5xl font-bold text-blue-600">
            {isComplete ? "통과하셨습니다" : moveCount}
          </p>
          {!isComplete && (
            <p className="mt-2 text-sm font-medium text-neutral-500">{moveCount} / {required}</p>
          )}
          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-10">
            <LaptopIcon className="mx-auto h-28 w-36 text-blue-700" />
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-5xl font-bold text-blue-600">
            {isComplete ? "통과하셨습니다" : moveCount}
          </p>
          {!isComplete && (
            <p className="mt-2 text-sm font-medium text-neutral-500">{moveCount} / {required}</p>
          )}
          <div className="relative mt-6 h-80 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 touch-none">
            <div
              className="absolute left-1/2 grid h-28 w-40 cursor-grab select-none place-items-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200 transition-shadow active:cursor-grabbing active:shadow-md"
              style={{ top: `${dragY}%`, transform: "translate(-50%, -50%)" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              role="button"
              aria-label={UI.dragFallbackInstruction}
              tabIndex={0}
            >
              <LaptopIcon className="h-20 w-28 text-blue-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LaptopIcon({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="mx-auto h-[68%] w-[78%] rounded-t-lg border-[6px] border-current bg-blue-50 p-2">
        <div className="h-full rounded-sm bg-blue-100" />
      </div>
      <div className="mx-auto h-[10%] w-full rounded-b-xl bg-current" />
      <div className="mx-auto h-[4%] w-[52%] rounded-b bg-current opacity-70" />
    </div>
  );
}

function rectToStage(rect: DOMRect): Pick<DOMRect, "top" | "height"> {
  return {
    top: rect.top - 96,
    height: rect.height + 192,
  };
}

function variationCoefficient(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
