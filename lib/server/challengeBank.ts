import { v4 as uuidv4 } from "uuid";
import { CHALLENGE_PROMPTS } from "../ko";
import type {
  ChallengeType,
  ClientChallengeConfig,
  SessionChallengeState,
} from "../types";
import { HIDDEN_TEXT_BANK } from "./koSecrets";

const CHALLENGE_ORDER: ChallengeType[] = [
  "timing",
  "hidden-text",
  "shape-tracing",
  "reflection",
  "opinion",
  "discrimination-safety",
  "ramen-image",
  "relationship-opinion",
  "captcha-loop",
];

function generateCaptchaText(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function createSessionChallenges(): SessionChallengeState[] {
  const hiddenEntry =
    HIDDEN_TEXT_BANK[Math.floor(Math.random() * HIDDEN_TEXT_BANK.length)];
  const captchaTexts = Array.from({ length: 6 }, () => generateCaptchaText());

  return CHALLENGE_ORDER.map((challengeType) => {
    const secrets: Record<string, unknown> = {};

    if (challengeType === "hidden-text") {
      secrets.word = hiddenEntry.word;
      secrets.expectedAnswer = hiddenEntry.word;
    }

    if (challengeType === "captcha-loop") {
      secrets.captchaTexts = captchaTexts;
    }

    return {
      challengeType,
      challengeId: uuidv4(),
      secrets,
    };
  });
}

export function getClientChallengeConfig(
  challenges: SessionChallengeState[],
  index: number
): ClientChallengeConfig | null {
  if (index < 0 || index >= challenges.length) return null;

  const challenge = challenges[index];
  const prompts = CHALLENGE_PROMPTS[challenge.challengeType];
  const config: Record<string, unknown> = {};

  switch (challenge.challengeType) {
    case "hidden-text":
      config.word = challenge.secrets.word;
      config.textDelayMs = 5000;
      break;
    case "timing":
      config.targetMs = 10000;
      break;
    case "device-motion":
      config.requiredMovements = 3;
      break;
    case "opinion":
      break;
    case "ramen-image":
      config.images = ["/assets/ramen_1.png", "/assets/ramen_2.png"];
      break;
    case "shape-tracing":
      config.shapes = ["circle", "triangle", "star"];
      break;
    case "captcha-loop": {
      const texts = challenge.secrets.captchaTexts as string[];
      config.initialCaptcha = texts[0] ?? generateCaptchaText();
      break;
    }
  }

  return {
    challengeId: challenge.challengeId,
    challengeType: challenge.challengeType,
    index,
    total: challenges.length,
    prompt: prompts.prompt,
    warning: "warning" in prompts ? prompts.warning : undefined,
    config,
  };
}

export const TOTAL_CHALLENGES = CHALLENGE_ORDER.length;
