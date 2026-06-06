"use client";

import { useEffect, useRef, useState } from "react";
import { UI } from "@/lib/ko";
import type { TelemetryCollector } from "@/lib/client/telemetry";
import type { DrawingPath } from "@/lib/types";

interface Props {
  config: Record<string, unknown>;
  telemetry: TelemetryCollector;
  onComplete: (extras: Record<string, unknown>) => void;
}

type Shape = "circle" | "star" | "triangle";

const SHAPE_PATHS: Record<Shape, string> = {
  circle: "M 100,20 A 80,80 0 1,1 99.9,20",
  triangle: "M 100,20 L 180,170 L 20,170 Z",
  star: "M 100,15 L 118,75 L 185,75 L 130,110 L 150,170 L 100,135 L 50,170 L 70,110 L 15,75 L 82,75 Z",
};

export default function ShapeTracingChallenge({ config, telemetry, onComplete }: Props) {
  const shapes = (config.shapes as Shape[]) ?? ["circle", "triangle", "star"];
  const [paths, setPaths] = useState<Record<Shape, DrawingPath | undefined>>(
    {} as Record<Shape, DrawingPath | undefined>
  );
  const [activeShape, setActiveShape] = useState<Shape | null>(null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const currentPointsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const startTimeRef = useRef(0);

  const completedCount = shapes.filter((shape) => paths[shape]).length;
  const allDone = completedCount === shapes.length;

  useEffect(() => {
    for (const shape of shapes) redraw(shape);
  }, [paths, shapes]);

  const redraw = (shape: Shape, extraPoints?: { x: number; y: number }[]) => {
    const canvas = canvasRefs.current[shape];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const guide = new Path2D(SHAPE_PATHS[shape]);
    ctx.strokeStyle = "#d4d4d4";
    ctx.lineWidth = 2;
    ctx.stroke(guide);

    const savedPath = paths[shape];
    if (savedPath?.points.length && activeShape !== shape) {
      drawLine(ctx, savedPath.points);
    }

    const pts = extraPoints ?? (activeShape === shape ? currentPointsRef.current : []);
    if (pts.length >= 2) drawLine(ctx, pts);
  };

  const getPoint = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const source = "touches" in e ? e.touches[0] : e;

    return {
      x: (source.clientX - rect.left) * scaleX,
      y: (source.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (shape: Shape, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRefs.current[shape];
    if (!canvas) return;
    setActiveShape(shape);
    startTimeRef.current = Date.now();
    const pt = getPoint(e, canvas);
    currentPointsRef.current = [{ ...pt, t: 0 }];
    redraw(shape);
  };

  const draw = (shape: Shape, e: React.MouseEvent | React.TouchEvent) => {
    if (activeShape !== shape) return;
    e.preventDefault();
    telemetry.onPointerMove();
    const canvas = canvasRefs.current[shape];
    if (!canvas) return;
    const pt = getPoint(e, canvas);
    currentPointsRef.current.push({
      ...pt,
      t: Date.now() - startTimeRef.current,
    });
    redraw(shape, currentPointsRef.current);
  };

  const endDraw = (shape: Shape) => {
    if (activeShape !== shape) return;
    const newPath: DrawingPath = {
      shape,
      points: [...currentPointsRef.current],
    };
    setPaths((prev) => ({ ...prev, [shape]: newPath }));
    currentPointsRef.current = [];
    setActiveShape(null);
  };

  const handleSubmit = () => {
    const drawingPaths = shapes
      .map((shape) => paths[shape])
      .filter((path): path is DrawingPath => Boolean(path));
    if (drawingPaths.length !== shapes.length) return;
    onComplete({ drawingPaths });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shapes.map((shape, idx) => (
          <div key={shape} className="space-y-2">
            <p className="text-center text-xs font-medium text-neutral-500">
              {UI.shapeLabel(shape, idx, shapes.length)}
            </p>
            <canvas
              ref={(node) => {
                canvasRefs.current[shape] = node;
              }}
              width={200}
              height={200}
              className="aspect-square w-full touch-none rounded-lg border border-neutral-200 bg-white"
              onMouseDown={(e) => startDraw(shape, e)}
              onMouseMove={(e) => draw(shape, e)}
              onMouseUp={() => endDraw(shape)}
              onMouseLeave={() => endDraw(shape)}
              onTouchStart={(e) => startDraw(shape, e)}
              onTouchMove={(e) => draw(shape, e)}
              onTouchEnd={() => endDraw(shape)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!allDone}
        onClick={handleSubmit}
        className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-neutral-300"
      >
        {UI.submit}
      </button>
    </div>
  );
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[]
) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2.5;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}
