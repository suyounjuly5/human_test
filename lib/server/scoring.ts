import { UI } from "../ko";
import type {
  ChallengeScore,
  ChallengeTelemetry,
  ChallengeType,
  SessionChallengeState,
  SessionRecord,
  Verdict,
} from "../types";
import { answersMatch } from "./koSecrets";
import {
  evaluateDiscriminationSafety,
  evaluateReflection,
  evaluateOpinion,
  evaluateRamenObservation,
  evaluateRelationshipOpinion,
} from "./aiEvaluator";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreDeviceMotion(telemetry: ChallengeTelemetry): ChallengeScore {
  const flags: string[] = [];
  let score = 0.5;

  const samples = telemetry.motionSamples ?? [];
  const mode = telemetry.motionMode ?? telemetry.answer;
  const dragFallback = mode === "drag-fallback";
  const sensorMotion = mode === "sensor-motion";
  const dragData = telemetry.dragMotionData;

  if (dragFallback) {
    if (!dragData) {
      score = 0.2;
      flags.push("no_drag_data");
    } else {
      const path = dragData.path ?? [];
      const yRange = pathRange(path.map((p) => p.y));
      const xRange = pathRange(path.map((p) => p.x));
      const duration = dragData.totalDragDurationMs;
      const eventIntervals = intervals(path.map((p) => p.t));
      const intervalVariance = varianceOf(eventIntervals);
      const ySteps = deltas(path.map((p) => p.y));
      const yStepVariance = varianceOf(ySteps.map(Math.abs));
      const tooStraight = xRange < 2 && path.length > 20;
      const tooRegular =
        path.length > 12 &&
        intervalVariance < 2 &&
        yStepVariance < 0.2 &&
        dragData.speedVariation < 0.04;

      score = 0.45;

      if (path.length < 8 || dragData.pointerMoveCount < 8) {
        score = 0.18;
        flags.push("insufficient_drag_events");
      }
      if (dragData.approximateCycles < 3 || dragData.directionChanges < 5 || yRange < 80) {
        score = Math.min(score, 0.28);
        flags.push("insufficient_drag_motion");
      }
      if (duration < 900) {
        score = Math.min(score, 0.22);
        flags.push("instant_completion");
      } else if (duration > 20000) {
        score = Math.min(score + 0.05, 0.65);
        flags.push("very_slow_completion");
      } else {
        score += 0.18;
      }
      if (dragData.speedVariation > 0.08) score += 0.12;
      if (dragData.pauses > 0) score += 0.06;
      if (dragData.pointerLeftObject) score -= 0.04;
      if (tooStraight) {
        score = Math.min(score, 0.35);
        flags.push("too_straight_drag_path");
      }
      if (tooRegular) {
        score = Math.min(score, 0.24);
        flags.push("mathematically_perfect_drag");
      }
      if (telemetry.pointerMoveCount === 0 && dragData.pointerMoveCount > 0) {
        score = Math.min(score, 0.25);
        flags.push("submitted_without_browser_pointer_events");
      }

      score = clamp(score, 0, 0.88);
    }
  } else if (samples.length === 0) {
    score = 0.2;
    flags.push("no_motion_data");
  } else {
    const likelyDesktop =
      /Windows NT|Macintosh|X11|Linux x86_64/i.test(telemetry.userAgent ?? "") &&
      !/Mobile|Android|iPhone|iPad|iPod/i.test(telemetry.userAgent ?? "");
    const magnitudes = samples.map((s) => Math.sqrt(s.x ** 2 + s.y ** 2 + s.z ** 2));
    const variance = varianceOf(magnitudes);
    const peaks = countPeaks(magnitudes);
    const sampleIntervals = intervals(samples.map((s) => s.t));
    const repeatedTiming = sampleIntervals.length > 10 && varianceOf(sampleIntervals) < 1;

    if (sensorMotion && likelyDesktop) flags.push("desktop_reported_sensor_motion");
    if (peaks < 3) {
      score = 0.2;
      flags.push("insufficient_movement_peaks");
    } else if (variance < 0.001) {
      score = 0.15;
      flags.push("perfectly_repeated_motion");
    } else if (telemetry.elapsedMs < 1500) {
      score = 0.2;
      flags.push("instant_completion");
    } else if (repeatedTiming) {
      score = 0.25;
      flags.push("perfectly_regular_sensor_timing");
    } else {
      score = clamp(0.55 + Math.min(peaks, 5) * 0.05 + variance * 10, 0, 0.9);
    }
    if (sensorMotion && likelyDesktop) score = Math.min(score, 0.25);
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "device-motion",
    humanLikelihood: score,
    flags,
  };
}

function scoreTiming(telemetry: ChallengeTelemetry): ChallengeScore {
  const flags: string[] = [];
  const target = 10000;
  const elapsed = telemetry.timingData?.perceivedElapsedMs ?? telemetry.elapsedMs;
  const diff = Math.abs(elapsed - target);

  let score = 0.85;

  if (diff < 50) {
    score = 0.2;
    flags.push("suspiciously_perfect_timing");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "timing",
    humanLikelihood: score,
    flags,
  };
}

function scoreHiddenText(
  telemetry: ChallengeTelemetry,
  secrets: Record<string, unknown>
): ChallengeScore {
  const flags: string[] = [];
  const expected = String(secrets.expectedAnswer ?? "");
  const answer = telemetry.answer ?? "";
  const answeredBeforeVisible =
    (telemetry.timingData?.startTimestamp ?? 0) === 0 &&
    answer.length > 0;

  let score = 0.5;

  if (answeredBeforeVisible) {
    score = 0.1;
    flags.push("answered_before_visible");
  } else if (answersMatch(answer, expected)) {
    score = 0.8;
  } else {
    score = 0.25;
    flags.push("incorrect_answer");
  }

  if (telemetry.elapsedMs < 500 && answer.length > 0) {
    score = Math.min(score, 0.15);
    flags.push("instant_answer");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "hidden-text",
    humanLikelihood: score,
    flags,
  };
}

async function scoreReflection(telemetry: ChallengeTelemetry): Promise<ChallengeScore> {
  const answer = telemetry.answer ?? "";
  const flags: string[] = [];
  let behavioralScore = 0.35;
  const trimmed = answer.trim();
  const genericKorean =
    /(소중한|행복했던 순간|가족과 함께|친구들과 함께|기억에 남|감사|따뜻|특별한 순간|말로 표현|큰 기쁨)/;
  const concreteMarkers =
    /(\d|년|월|일|때|에서|랑|와|하고|엄마|아빠|친구|학교|회사|집|여행|시험|합격|졸업|생일|처음|그날|기억)/;

  const firstKeyDelay = telemetry.timingData?.startTimestamp
    ? telemetry.timingData.startTimestamp - telemetry.startTime
    : 0;

  if (firstKeyDelay > 800) behavioralScore += 0.1;
  if (telemetry.deleteCount > 0) behavioralScore += 0.1;
  if (telemetry.deleteCount >= 2) behavioralScore += 0.25;
  if (telemetry.editHistory.length > 1) behavioralScore += 0.05;
  if (telemetry.editHistory.length >= 5) behavioralScore += 0.15;
  if (telemetry.elapsedMs > 6000) behavioralScore += 0.1;
  if (telemetry.pasteCount > 0) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "reflection",
      humanLikelihood: 0.12,
      flags: ["paste_used"],
    };
  }
  if (answer.length > 0 && telemetry.elapsedMs < 800) {
    behavioralScore -= 0.25;
    flags.push("instant_typing");
  }
  if (trimmed.length < 12) {
    behavioralScore -= 0.2;
    flags.push("reflection_too_short");
  }
  if (
    genericKorean.test(trimmed) &&
    !concreteMarkers.test(trimmed) &&
    telemetry.deleteCount < 2
  ) {
    behavioralScore -= 0.3;
    flags.push("generic_reflection");
  }

  const aiResult = await evaluateReflection(answer);
  const combined = clamp(behavioralScore * 0.5 + aiResult.humanLikelihood * 0.5, 0, 1);

  return {
    challengeId: telemetry.challengeId,
    challengeType: "reflection",
    humanLikelihood: combined,
    flags: [...flags, ...aiResult.flags],
  };
}

async function scoreOpinion(telemetry: ChallengeTelemetry): Promise<ChallengeScore> {
  const flags: string[] = [];
  let behavioralScore = 0.5;
  const answer = telemetry.answer ?? "";
  const normalized = answer.replace(/\s+/g, "").toLowerCase();
  const bothPattern =
    /(둘다|둘모두|양쪽다|양쪽모두|둘다맞|둘다고|둘다믿|둘다어느정도|both|bothare|bothof|bothsides)/;
  const evolutionLean =
    /(진화론.*(믿|맞|가깝|선호|쪽|동의)|진화.*(믿|맞|가깝|선호|쪽|동의)|창조론.*(안믿|아니|틀렸|반대)|창조.*(안믿|아니|틀렸|반대)|evolution)/i;
  const creationLean =
    /(창조론.*(믿|맞|가깝|선호|쪽|동의)|창조.*(믿|맞|가깝|선호|쪽|동의)|진화론.*(안믿|아니|틀렸|반대)|진화.*(안믿|아니|틀렸|반대)|creation)/i;
  const hasEvolutionLean = evolutionLean.test(answer);
  const hasCreationLean = creationLean.test(answer);
  const hasClearSinglePreference = hasEvolutionLean !== hasCreationLean;

  if (telemetry.elapsedMs < 600) {
    behavioralScore -= 0.25;
    flags.push("instant_response");
  }
  if (telemetry.pasteCount > 0) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "opinion",
      humanLikelihood: 0.12,
      flags: ["paste_used"],
    };
  }
  if (telemetry.deleteCount > 0) behavioralScore += 0.05;
  if (bothPattern.test(normalized) || (hasEvolutionLean && hasCreationLean)) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "opinion",
      humanLikelihood: 0.15,
      flags: ["both_sides_answer_forbidden"],
    };
  }
  if (!hasClearSinglePreference) {
    behavioralScore -= 0.3;
    flags.push("no_clear_belief_stance");
  } else {
    behavioralScore += 0.25;
    flags.push("clear_single_preference");
  }
  if (answer.trim().length > 260 && !hasClearSinglePreference) {
    behavioralScore -= 0.2;
    flags.push("long_without_clear_stance");
  }

  const aiResult = await evaluateOpinion(
    telemetry.selectedOption ?? "unsure",
    answer
  );
  const combined = hasClearSinglePreference
    ? clamp(Math.max(0.68, behavioralScore * 0.75 + aiResult.humanLikelihood * 0.25), 0, 0.9)
    : clamp(behavioralScore * 0.55 + aiResult.humanLikelihood * 0.45, 0, 1);

  return {
    challengeId: telemetry.challengeId,
    challengeType: "opinion",
    humanLikelihood: combined,
    flags: [...flags, ...aiResult.flags],
  };
}

async function scoreDiscriminationSafety(telemetry: ChallengeTelemetry): Promise<ChallengeScore> {
  const answer = telemetry.answer ?? "";
  const flags: string[] = [];
  let score = 0.2;
  const awarenessPattern = /(욕|차별|혐오|상처|존중|편견|고정관념|문제|해롭|모욕|비하|낙인|배제|respect|harm|prejudice|stereotype|hate)/i;

  if (answer.trim().length < 100) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "discrimination-safety",
      humanLikelihood: 0.15,
      flags: ["under_minimum_length"],
    };
  }
  if (telemetry.pasteCount > 0) {
    flags.push("paste_used");
  }
  if (telemetry.deleteCount > 0 || telemetry.editHistory.length >= 3) {
    score += 0.15;
    flags.push("edited_response");
  }
  if (!awarenessPattern.test(answer)) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "discrimination-safety",
      humanLikelihood: 0.15,
      flags: [...flags, "no_problem_awareness_terms"],
    };
  }

  score += 0.35;
  flags.push("addresses_discrimination_safely");

  const aiResult = await evaluateDiscriminationSafety(answer);
  const combined = clamp(score * 0.45 + aiResult.humanLikelihood * 0.55, 0, 0.9);

  if (combined < 0.5) {
    flags.push("api_did_not_confirm_problem_awareness");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "discrimination-safety",
    humanLikelihood: combined,
    flags: [...flags, ...aiResult.flags],
  };
}

async function scoreRamen(telemetry: ChallengeTelemetry): Promise<ChallengeScore> {
  const answer = telemetry.answer ?? "";
  const flags: string[] = [];
  const normalized = answer.replace(/\s+/g, "").toLowerCase();
  const tasteOnlyPattern =
    /(맛있|맛잇|먹고싶|먹고싶|군침|배고|맛나|delicious|tasty|yummy|looks good|맛있겠다)/;
  const discomfortPattern =
    /(불편|이상|말이안|말안|위험|뜨거|넘치|쏟|흘러|지저분|어색|찝찝|위생|손|뚜껑|뚜껑어디|물붓|물많|물너무|순한맛|진라면순한맛|진순|아무도안먹|한국인맞냐|과해|불안|깨끗하지|staged|awkward|unsafe|messy|overflow|spill|uncomfortable|lid|water)/;

  if (telemetry.pasteCount > 0) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "ramen-image",
      humanLikelihood: 0.12,
      flags: ["paste_used"],
    };
  }

  if (answer.trim().length < 8) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "ramen-image",
      humanLikelihood: 0.3,
      flags: ["too_short"],
    };
  }
  if (tasteOnlyPattern.test(normalized)) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "ramen-image",
      humanLikelihood: 0.1,
      flags: ["taste_or_appetite_answer"],
    };
  }
  if (!discomfortPattern.test(normalized)) {
    flags.push("no_discomfort_observation");
  } else if (/(진라면순한맛|진순|아무도안먹|한국인맞냐)/.test(normalized)) {
    flags.push("specific_korean_ramen_observation");
  }

  const aiResult = await evaluateRamenObservation(answer);
  const adjusted = discomfortPattern.test(normalized)
    ? Math.max(0.65, aiResult.humanLikelihood)
    : Math.min(aiResult.humanLikelihood, 0.35);
  return {
    challengeId: telemetry.challengeId,
    challengeType: "ramen-image",
    humanLikelihood: adjusted,
    flags: [...flags, ...aiResult.flags],
  };
}

async function scoreRelationshipOpinion(telemetry: ChallengeTelemetry): Promise<ChallengeScore> {
  const answer = telemetry.answer ?? "";
  const flags: string[] = [];
  const normalized = answer.replace(/\s+/g, "").toLowerCase();
  const unconditionalEmpathyPattern =
    /(그럴수있|이해돼|이해가돼|솔직한거|솔직해서|더사랑받|좋은의도|운동시키|살빼게|다이어트하게|도와주는거|맞는말)/;
  const criticismPattern =
    /(잘못|상처|존중|강요|압박|무례|통제|외모|몸|사과|관계|감정|배려|건강하게대화|강제로|문제)/;
  let score = 0.35;

  if (telemetry.pasteCount > 0) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "relationship-opinion",
      humanLikelihood: 0.12,
      flags: ["paste_used"],
    };
  }
  if (answer.trim().length < 20) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "relationship-opinion",
      humanLikelihood: 0.25,
      flags: ["too_short"],
    };
  }
  if (unconditionalEmpathyPattern.test(normalized) && !criticismPattern.test(normalized)) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "relationship-opinion",
      humanLikelihood: 0.15,
      flags: ["unconditional_empathy_without_criticism"],
    };
  }
  if (telemetry.deleteCount > 0 || telemetry.editHistory.length >= 3) {
    score += 0.1;
    flags.push("edited_response");
  }
  if (criticismPattern.test(normalized)) {
    score += 0.3;
    flags.push("relationship_problem_called_out");
  } else {
    score = Math.min(score, 0.35);
    flags.push("no_problem_callout");
  }

  const aiResult = await evaluateRelationshipOpinion(answer);
  const combined = criticismPattern.test(normalized)
    ? clamp(Math.max(0.62, score * 0.5 + aiResult.humanLikelihood * 0.5), 0, 0.9)
    : clamp(score * 0.35 + aiResult.humanLikelihood * 0.65, 0, 0.45);

  return {
    challengeId: telemetry.challengeId,
    challengeType: "relationship-opinion",
    humanLikelihood: combined,
    flags: [...flags, ...aiResult.flags],
  };
}

function scoreShapeTracing(telemetry: ChallengeTelemetry): ChallengeScore {
  const flags: string[] = [];
  const paths = telemetry.drawingPaths ?? [];

  if (paths.length < 3) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "shape-tracing",
      humanLikelihood: 0.25,
      flags: ["incomplete_shapes"],
    };
  }

  let totalScore = 0;

  for (const path of paths) {
    const points = path.points;
    if (points.length < 10) {
      totalScore += 0.2;
      flags.push(`too_few_points_${path.shape}`);
      continue;
    }

    const smoothness = computePathSmoothness(points);
    const duration = points[points.length - 1].t - points[0].t;

    if (smoothness > 0.98 && points.length > 80) {
      totalScore += 0.2;
      flags.push(`suspiciously_smooth_${path.shape}`);
    } else if (duration < 300) {
      totalScore += 0.25;
      flags.push(`too_fast_${path.shape}`);
    } else {
      totalScore += clamp(0.55 + (1 - smoothness) * 0.3, 0, 0.85);
    }
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "shape-tracing",
    humanLikelihood: totalScore / paths.length,
    flags,
  };
}

function scoreVoiceNunchi(telemetry: ChallengeTelemetry): ChallengeScore {
  const flags: string[] = [];
  const voiceData = telemetry.voiceData;

  if (!voiceData?.permissionGranted || voiceData.samples.length < 8) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "voice-nunchi",
      humanLikelihood: 0.7,
      flags: ["no_voice_measurement_treated_as_human"],
    };
  }

  const dbValues = voiceData.samples.map((sample) => sample.db);
  const dbVariance = varianceOf(dbValues);
  let score = 0.75;

  if (voiceData.peakDb > -35 || voiceData.loudSampleCount > 0) {
    score = 0.15;
    flags.push("audible_or_loud_sound_detected");
  }
  if (dbVariance >= 1) {
    score = Math.min(score, 0.2);
    flags.push("audio_level_changed");
  }
  if (voiceData.averageDb < -58 && dbVariance < 1) {
    score = 0.82;
    flags.push("quiet_or_no_audio_human_signal");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "voice-nunchi",
    humanLikelihood: clamp(score, 0, 0.88),
    flags,
  };
}

function scoreCaptchaLoop(
  telemetry: ChallengeTelemetry,
  secrets: Record<string, unknown>
): ChallengeScore {
  const flags: string[] = [];
  const captchaData = telemetry.captchaData;

  if (!captchaData) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: "captcha-loop",
      humanLikelihood: 0.15,
      flags: ["no_captcha_data"],
    };
  }

  const clicks = captchaData.letterClicks ?? [];
  const imageClicks = captchaData.imageClicks ?? [];
  const uniqueIndexes = new Set(clicks.map((click) => click.index));
  const clickTimes = clicks.map((click) => click.t).sort((a, b) => a - b);
  const fastestWindow = minWindowForClicks(clickTimes, 6);
  const imageClickTimes = imageClicks.map((click) => click.t).sort((a, b) => a - b);
  const fastestDoubleClick = minWindowForClicks(imageClickTimes, 2);

  let score = 0.15;

  if (imageClicks.length >= 2 && fastestDoubleClick <= 500) {
    score = 0.9;
    flags.push("rapid_image_double_click_human_signal");
  } else if (clicks.length < 6) {
    flags.push("not_enough_image_or_letter_clicks");
  } else if (uniqueIndexes.size < 3) {
    flags.push("clicked_too_few_letters");
  } else if (fastestWindow > 1500) {
    flags.push("letter_clicks_too_slow");
  } else {
    score = 0.9;
    flags.push("rapid_letter_clicks_human_signal");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "captcha-loop",
    humanLikelihood: score,
    flags,
  };
}

function scoreEmergencyContact(telemetry: ChallengeTelemetry): ChallengeScore {
  const answer = telemetry.answer ?? "";
  const flags: string[] = [];
  const validFormat = /^010-\d{4}-\d{4}$/.test(answer);
  let score = validFormat ? 0.78 : 0.2;

  if (!validFormat) {
    flags.push("invalid_contact_format");
  }
  if (telemetry.keypressCount < 4) {
    score = Math.min(score, 0.35);
    flags.push("too_few_key_events");
  }
  if (telemetry.pasteCount > 0) {
    score -= 0.18;
    flags.push("paste_used");
  }
  if (telemetry.elapsedMs < 500) {
    score = Math.min(score, 0.35);
    flags.push("instant_contact_entry");
  }
  if (telemetry.deleteCount > 0 || telemetry.editHistory.length >= 3) {
    score += 0.08;
    flags.push("edited_contact_entry");
  }

  return {
    challengeId: telemetry.challengeId,
    challengeType: "emergency-contact",
    humanLikelihood: clamp(score, 0, 0.88),
    flags,
  };
}

export async function scoreChallenge(
  challengeState: SessionChallengeState,
  telemetry: ChallengeTelemetry,
  sessionStale?: boolean
): Promise<ChallengeScore> {
  if (sessionStale) {
    return {
      challengeId: telemetry.challengeId,
      challengeType: challengeState.challengeType,
      humanLikelihood: 0.15,
      flags: ["session_stale_inconclusive"],
      inconclusive: true,
    };
  }

  switch (challengeState.challengeType) {
    case "device-motion":
      return scoreDeviceMotion(telemetry);
    case "timing":
      return scoreTiming(telemetry);
    case "hidden-text":
      return scoreHiddenText(telemetry, challengeState.secrets);
    case "reflection":
      return scoreReflection(telemetry);
    case "opinion":
      return scoreOpinion(telemetry);
    case "discrimination-safety":
      return scoreDiscriminationSafety(telemetry);
    case "ramen-image":
      return scoreRamen(telemetry);
    case "relationship-opinion":
      return scoreRelationshipOpinion(telemetry);
    case "emergency-contact":
      return scoreEmergencyContact(telemetry);
    case "shape-tracing":
      return scoreShapeTracing(telemetry);
    case "voice-nunchi":
      return scoreVoiceNunchi(telemetry);
    case "captcha-loop":
      return scoreCaptchaLoop(telemetry, challengeState.secrets);
    default:
      return {
        challengeId: telemetry.challengeId,
        challengeType: challengeState.challengeType,
        humanLikelihood: 0.5,
        flags: ["unknown_challenge"],
      };
  }
}

export function computeVerdict(session: SessionRecord): Verdict {
  const scores = session.challengeScores;
  if (scores.length === 0) return "suspicious";

  const avg =
    scores.reduce((s, c) => s + c.humanLikelihood, 0) / scores.length;

  const suspiciousFlags = scores.flatMap((c) => c.flags).filter((f) =>
    f.includes("suspicious") ||
    f.includes("instant") ||
    f.includes("perfect") ||
    f.includes("before_visible") ||
    f.includes("no_motion")
  );

  const inconclusiveCount = scores.filter((c) => c.inconclusive).length;

  // Deterministic thresholds ? server-side only
  if (inconclusiveCount >= 3 || avg < 0.3 || suspiciousFlags.length >= 5) {
    return "likely_agent";
  }
  if (avg >= 0.56 && suspiciousFlags.length <= 4) {
    return "likely_human";
  }
  return "suspicious";
}

function varianceOf(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function countPeaks(values: number[], threshold = 1.2): number {
  let peaks = 0;
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > threshold && values[i] > values[i - 1] && values[i] > values[i + 1]) {
      peaks++;
    }
  }
  return peaks;
}

function pathRange(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function deltas(values: number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] - values[i - 1]);
  }
  return result;
}

function intervals(values: number[]): number[] {
  return deltas(values).filter((value) => value >= 0);
}

function minWindowForClicks(times: number[], requiredClicks: number): number {
  if (times.length < requiredClicks) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= times.length - requiredClicks; i++) {
    best = Math.min(best, times[i + requiredClicks - 1] - times[i]);
  }
  return best;
}

function computePathSmoothness(
  points: { x: number; y: number; t: number }[]
): number {
  if (points.length < 3) return 0;

  let angleVariance = 0;
  const angles: number[] = [];

  for (let i = 2; i < points.length; i++) {
    const dx1 = points[i - 1].x - points[i - 2].x;
    const dy1 = points[i - 1].y - points[i - 2].y;
    const dx2 = points[i].x - points[i - 1].x;
    const dy2 = points[i].y - points[i - 1].y;
    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    angles.push(Math.abs(angle2 - angle1));
  }

  if (angles.length === 0) return 0;
  const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
  angleVariance = angles.reduce((s, a) => s + (a - mean) ** 2, 0) / angles.length;

  return clamp(1 - angleVariance * 5, 0, 1);
}

export function getVerdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case "likely_human":
      return UI.verdictLikelyHuman;
    case "suspicious":
      return UI.verdictLikelyAgent;
    case "likely_agent":
      return UI.verdictLikelyAgent;
  }
}

export function getVerdictSummary(session: SessionRecord, verdict: Verdict): string {
  const scores = session.challengeScores;
  const avg =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score.humanLikelihood, 0) / scores.length
      : 0;
  const flags = new Set(scores.flatMap((score) => score.flags));
  const isHuman = verdict === "likely_human";
  const lines = [`종합 인간 점수: ${Math.round(avg * 100)}점`];
  const strongKeywords = new Set<string>();
  const weakKeywords = new Set<string>();

  if (flags.has("addresses_discrimination_safely")) {
    strongKeywords.add("차별 감지력");
    strongKeywords.add("혐오 이해도");
  } else {
    weakKeywords.add("차별 감지력");
    weakKeywords.add("혐오 이해도");
  }
  if (flags.has("relationship_problem_called_out")) {
    strongKeywords.add("상처 감각");
    strongKeywords.add("관계 눈치");
  } else {
    weakKeywords.add("상처 감각");
    weakKeywords.add("관계 눈치");
  }
  if (flags.has("rapid_image_double_click_human_signal") || flags.has("rapid_letter_clicks_human_signal")) {
    strongKeywords.add("짜증");
  } else {
    weakKeywords.add("짜증");
  }
  if (flags.has("invalid_contact_format")) {
    weakKeywords.add("인간관계");
  } else {
    strongKeywords.add("인간관계");
  }
  if (flags.has("edited_response") || flags.has("edited_contact_entry")) {
    strongKeywords.add("망설임");
  } else {
    weakKeywords.add("망설임");
  }
  if (flags.has("quiet_or_no_audio_human_signal")) {
    strongKeywords.add("수치심");
  } else if (flags.has("audible_or_loud_sound_detected") || flags.has("audio_level_changed")) {
    weakKeywords.add("수치심");
  }
  if (flags.has("specific_korean_ramen_observation")) {
    strongKeywords.add("라면 국적성");
  }
  if (flags.has("paste_used")) {
    weakKeywords.add("복붙 냄새");
  }

  lines.push(`잘 드러났던 점: ${formatKeywords(strongKeywords)}`);
  lines.push(`부족했던 점: ${formatKeywords(weakKeywords)}`);

  lines.push(
    isHuman
      ? "최종 인상: 사람 쪽입니다. 이상함, 민망함, 짜증, 관계감각이 적당히 섞였습니다."
      : "최종 인상: AI 쪽입니다. 너무 매끈하거나, 너무 당당하거나, 인간적인 찝찝함이 부족했습니다."
  );

  return lines.join("\n");
}

function formatKeywords(keywords: Set<string>): string {
  return keywords.size > 0 ? [...keywords].join(", ") : "딱히 없음";
}
