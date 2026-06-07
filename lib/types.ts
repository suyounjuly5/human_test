export type ChallengeType =
  | "device-motion"
  | "timing"
  | "hidden-text"
  | "reflection"
  | "opinion"
  | "discrimination-safety"
  | "ramen-image"
  | "relationship-opinion"
  | "shape-tracing"
  | "captcha-loop";

export type Verdict = "likely_human" | "suspicious" | "likely_agent";

export interface ChallengeTelemetry {
  challengeId: string;
  startTime: number;
  endTime: number;
  elapsedMs: number;
  focusBlurCount: number;
  pointerMoveCount: number;
  keypressCount: number;
  pasteCount: number;
  deleteCount: number;
  editHistory: string[];
  answer?: string;
  motionMode?: "sensor-motion" | "drag-fallback";
  selectedOption?: string;
  drawingPaths?: DrawingPath[];
  motionSamples?: MotionSample[];
  dragMotionData?: DragMotionData;
  timingData?: TimingData;
  captchaData?: CaptchaLoopData;
  viewport?: { width: number; height: number };
  userAgent?: string;
}

export interface DrawingPath {
  shape: "circle" | "star" | "triangle";
  points: { x: number; y: number; t: number }[];
}

export interface MotionSample {
  x: number;
  y: number;
  z: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
  t: number;
}

export interface DragMotionData {
  pointerDownTime: number;
  pointerUpTime?: number;
  pointerMoveCount: number;
  totalDragDurationMs: number;
  path: { x: number; y: number; t: number; insideObject: boolean }[];
  directionChanges: number;
  approximateCycles: number;
  speedVariation: number;
  pauses: number;
  pointerLeftObject: boolean;
}

export interface TimingData {
  startTimestamp: number;
  stopTimestamp: number;
  perceivedElapsedMs: number;
  stopButtonHighlighted: boolean;
}

export interface CaptchaLoopData {
  roundsCompleted: number;
  rounds: {
    userInput: string;
    elapsedMs: number;
    usedEscape: boolean;
  }[];
  letterClicks?: { char: string; index: number; t: number }[];
  imageClicks?: { t: number }[];
  escapeClicked: boolean;
  helpOpened: boolean;
  backAttempts: number;
  complaintText?: string;
}

export interface ChallengeScore {
  challengeId: string;
  challengeType: ChallengeType;
  humanLikelihood: number;
  flags: string[];
  inconclusive?: boolean;
}

export interface SessionChallengeState {
  challengeType: ChallengeType;
  challengeId: string;
  /** Server-only secrets ? never sent to client */
  secrets: Record<string, unknown>;
  score?: ChallengeScore;
  submittedAt?: number;
  telemetry?: ChallengeTelemetry;
}

export interface SessionRecord {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  userAgent: string;
  viewport: { width: number; height: number };
  currentIndex: number;
  challenges: SessionChallengeState[];
  challengeScores: ChallengeScore[];
  finished: boolean;
  verdict?: Verdict;
  ipHash?: string;
}

export interface ClientChallengeConfig {
  challengeId: string;
  challengeType: ChallengeType;
  index: number;
  total: number;
  prompt: string;
  warning?: string;
  /** Non-sensitive challenge-specific UI config */
  config: Record<string, unknown>;
}

export interface SubmitResponse {
  action: "continue" | "finish" | "retry" | "assessment";
  nextChallenge?: ClientChallengeConfig;
  message?: string;
  assessmentLabel?: string;
  canContinue?: boolean;
}

export interface FinishResponse {
  verdict: Verdict;
  verdictLabel: string;
  sessionId: string;
}

export interface AdminAttemptSummary {
  sessionId: string;
  createdAt: string;
  finishedAt?: string;
  verdict?: Verdict;
  challengeCount: number;
  avgHumanLikelihood: number;
  flagSummary: string[];
}
