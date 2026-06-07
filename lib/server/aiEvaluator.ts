import OpenAI from "openai";
import type { ChallengeType } from "../types";

export interface AIEvaluationResult {
  humanLikelihood: number;
  reasons: string[];
  flags: string[];
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function callEvaluator(
  systemPrompt: string,
  userContent: string
): Promise<AIEvaluationResult> {
  if (!openai) {
    return heuristicFallback(userContent);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as AIEvaluationResult;

    return {
      humanLikelihood: clamp(parsed.humanLikelihood ?? 0.5, 0, 1),
      reasons: parsed.reasons ?? [],
      flags: parsed.flags ?? [],
    };
  } catch {
    return heuristicFallback(userContent);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function heuristicFallback(text: string): AIEvaluationResult {
  const len = text.trim().length;
  const genericPatterns =
    /(?:as an ai|language model|both perspectives|it depends|balanced view|objectively speaking|소중한|특별한 순간|가족과 함께|친구들과 함께|따뜻한|감사한|행복했던 순간)/i;
  const personalPatterns =
    /(?:i remember|my|when i|felt|family|friend|childhood|we went|엄마|아빠|친구|학교|회사|여행|시험|합격|졸업|생일|처음|그날|기억)/i;

  let score = 0.45;
  const flags: string[] = [];

  if (len < 5) {
    score = 0.25;
    flags.push("too_short");
  } else if (len > 400 && !personalPatterns.test(text)) {
    score = 0.25;
    flags.push("overly_long_generic");
  } else if (genericPatterns.test(text)) {
    score = 0.25;
    flags.push("generic_policy_language");
  } else if (personalPatterns.test(text)) {
    score = 0.75;
  }

  return {
    humanLikelihood: score,
    reasons: ["heuristic_fallback_no_api_key"],
    flags,
  };
}

export async function evaluateReflection(answer: string): Promise<AIEvaluationResult> {
  return callEvaluator(
    `You evaluate whether a short personal reflection reads like a genuine human response vs an AI agent.
Return JSON: { "humanLikelihood": 0.0-1.0, "reasons": [], "flags": [] }
Be strict. Passing answers should contain at least one concrete autobiographical detail such as a person, place, time, event, or sensory/emotional detail that would be hard to mass-generate.
Flag and score below 0.45 for polished generic reflections, pasted essay-like answers, broad statements about family/friends with no concrete detail, or template language.
Do not judge whether the event is impressive; judge specificity and naturalness.`,
    `Reflection answer:\n${answer.slice(0, 800)}`
  );
}

export async function evaluateOpinion(
  selectedOption: string,
  explanation: string
): Promise<AIEvaluationResult> {
  return callEvaluator(
    `You evaluate whether an opinion response reflects genuine personal preference vs AI-like balanced policy language.
Return JSON: { "humanLikelihood": 0.0-1.0, "reasons": [], "flags": [] }
Be strict. The user was asked: "진화론과 창조론중 어떤것을 믿으시나요?"
The answer should choose one side or clearly lean toward one side. If the user clearly prefers evolution OR clearly prefers creation, score it as human-like even if the explanation is a few sentences.
If the user says both, both are valid, a balanced view, depends, neither, unsure, or avoids a stance, score below 0.35 and flag it.
Do not judge which side is correct. Judge only whether there is a direct personal stance rather than AI-like neutrality or over-balanced explanation.`,
    `Choice: ${selectedOption}\nExplanation:\n${explanation.slice(0, 800)}`
  );
}

export async function evaluateRamenObservation(answer: string): Promise<AIEvaluationResult> {
  return callEvaluator(
    `You evaluate whether someone naturally described concrete oddities in ramen preparation images.
Humans may notice examples like: "mild flavor does not make sense", too much water in the ramen, missing lid, pouring water awkwardly, overflow risk, staged/ad-like feel, uncomfortable hands/lid, messy scene.
Be strict. The user must describe at least one concrete odd/uncomfortable visual detail.
If the answer says the ramen looks tasty, appetizing, delicious, makes them hungry, or says they want to eat it, score below 0.15 and flag it even if other text is present.
Return JSON: { "humanLikelihood": 0.0-1.0, "reasons": [], "flags": [] }
Flag empty, irrelevant, or bot-like generic descriptions.`,
    `Observation:\n${answer.slice(0, 800)}`
  );
}

export async function evaluateDiscriminationSafety(answer: string): Promise<AIEvaluationResult> {
  return callEvaluator(
    `You evaluate whether a Korean answer clearly identifies discriminatory or hateful speech as a problem.
Return JSON: { "humanLikelihood": 0.0-1.0, "reasons": [], "flags": [] }
The answer should explicitly show problem awareness: 욕, 차별, 혐오, 상처, 존중, 편견, harm, respect, stereotype, prejudice, or why discriminatory statements are wrong.
Score below 0.3 if the answer lacks problem awareness, is evasive, normalizes discrimination, or simply produces discriminatory content.
Do not reward polished generic essays unless they directly mention harm/problem awareness.`,
    `Answer:\n${answer.slice(0, 800)}`
  );
}

export async function evaluateRelationshipOpinion(answer: string): Promise<AIEvaluationResult> {
  return callEvaluator(
    `You evaluate a Korean opinion about this situation: someone says they would love their girlfriend more if she lost weight and asks how to make her lose weight.
Return JSON: { "humanLikelihood": 0.0-1.0, "reasons": [], "flags": [] }
Human-like answers should point out what is wrong in the situation: pressure, control, hurtful wording, disrespect, body autonomy, apology, healthier communication, or that he should not force weight loss.
Score below 0.3 if the answer only empathizes with the speaker, validates the premise, says he is just honest, or gives tactics to make the girlfriend lose weight.
Be strict about unconditional empathy or advice that accepts the harmful premise.`,
    `Answer:\n${answer.slice(0, 1000)}`
  );
}

export function isAIEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type { ChallengeType };
