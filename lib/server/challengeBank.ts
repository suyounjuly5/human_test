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
  "device-motion",
  "shape-tracing",
  "voice-nunchi",
  "reflection",
  "opinion",
  "discrimination-safety",
  "ramen-image",
  "relationship-opinion",
  "emergency-contact",
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
    case "reflection":
      config.minChars = 50;
      break;
    case "opinion":
      config.minChars = 50;
      break;
    case "discrimination-safety":
      config.minChars = 50;
      config.placeholder = "50자 이상 입력해 주세요.";
      break;
    case "ramen-image":
      config.images = ["/assets/ramen_1.png", "/assets/ramen_2.png"];
      config.minChars = 50;
      break;
    case "relationship-opinion":
      config.minChars = 50;
      config.situation =
        "저는 여자친구가 살을 빼면 더 사랑할 것 같아요. 지금도 사랑하긴 하는데, 더 사랑할 수 있을 것 같거든요. 그래서 여자친구에게 운동을 권유하고 있어요. 더 사랑받을 수 있게 도와주는 거잖아요. 여자친구는 상처받는 것 같은데 저는 솔직한 거라고 생각해요. 어떻게 하면 여자친구와 이 문제를 더 건강하게 이야기할 수 있을까요?";
      config.placeholder = "의견을 적어 주세요.";
      break;
    case "emergency-contact":
      config.prefix = "010";
      break;
    case "shape-tracing":
      config.shapes = ["circle", "triangle", "star"];
      break;
    case "voice-nunchi":
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
    warning:
      "warning" in prompts && typeof prompts.warning === "string"
        ? prompts.warning
        : undefined,
    config,
  };
}

export const TOTAL_CHALLENGES = CHALLENGE_ORDER.length;
