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
    }, 300);
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
    }, 300);
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

  const modeLabel = mode === "sensor-motion" ? UI.motionModeSensor : UI.motionModeDrag;
  if (mode === "checking" || mode === "permission") {
    return (
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>{mode === "permission" ? UI.motionPermission : UI.detectingDevice}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
        {modeLabel}
      </div>

      {mode === "sensor-motion" ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-4xl font-bold text-blue-600">{moveCount}</p>
          <p className="mt-2 text-sm text-neutral-600">{UI.motionCount(moveCount, required)}</p>
          <p className="mt-4 text-sm text-neutral-700">{UI.motionSensorInstruction}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {isComplete ? UI.motionComplete : UI.motionHint}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fallbackReason && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {fallbackReason}
            </p>
          )}
          <p className="text-sm text-neutral-700">{UI.dragFallbackInstruction}</p>
          <div className="relative h-72 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 touch-none">
            <div className="absolute bottom-8 left-1/2 top-8 w-px -translate-x-1/2 bg-neutral-300" />
            <div className="absolute left-1/2 top-8 h-[calc(100%-4rem)] w-20 -translate-x-1/2 rounded-full border border-dashed border-neutral-300" />
            <div
              className="absolute left-1/2 grid h-20 w-28 -translate-x-1/2 cursor-grab select-none place-items-center rounded-lg border border-blue-200 bg-white shadow-md transition-[box-shadow] active:cursor-grabbing"
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
              <div className="h-10 w-16 rounded border-2 border-neutral-700 bg-blue-50">
                <div className="mx-auto mt-1 h-5 w-10 rounded-sm bg-blue-200" />
              </div>
              <div className="h-1.5 w-20 rounded-b bg-neutral-700" />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-neutral-500">
              {isComplete ? UI.motionComplete : UI.dragHint(required, moveCount)}
            </p>
          </div>
        </div>
      )}
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
