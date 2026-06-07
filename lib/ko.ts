/**
 * UTF-8 Korean UI strings (client-safe).
 */

export const UI = {
  appName: "인간임을 증명하세요",
  appSubtitle: "실험용 인간 검증 프로토타입",

  headerTest: "인간 검증 테스트",
  progress: (current: number, total: number) => `문항 ${current + 1} / ${total}`,

  start: "시작",
  stop: "종료",
  next: "다음",
  submit: "제출",
  abort: "중단하기",
  retry: "다시 시도",
  confirm: "확인",
  home: "처음으로",

  processing: "처리 중…",
  preparing: "문항을 준비하는 중…",
  detectingDevice: "움직임 센서 사용 가능 여부를 확인하고 있습니다.",

  errorGeneric: "문제가 발생했습니다. 다시 시도해 주세요.",
  errorStart: "테스트를 시작할 수 없습니다. 다시 시도해 주세요.",
  errorSubmit: "제출에 실패했습니다.",

  timingKeyHint: "버튼을 누르거나 스페이스 바를 사용할 수 있습니다.",
  timingSeconds: (s: number) => `${s.toFixed(1)}초`,
  timingTooPerfect:
    "너무 정확하게 멈췄습니다. 다시 시도해 주세요.",

  motionCount: (count: number, required: number) =>
    `${count} / ${required}회 움직임 감지됨`,
  motionPermission:
    "기기 움직임을 측정하려면 브라우저 권한이 필요할 수 있습니다.",
  motionSensorUnavailable:
    "현재 환경에서는 기기 움직임 센서를 안정적으로 사용할 수 없습니다. 대신 화면 속 기기 아이콘을 직접 움직이는 방식으로 진행합니다.",
  motionModeSensor: "활성 모드: 기기 움직임 센서",
  motionModeDrag: "활성 모드: 화면 드래그",
  motionSensorInstruction:
    "기기를 절대 떨어뜨리지 마세요. 기기를 손에 들고 위아래로 세 번 천천히 움직여 주세요.",
  motionHint: "기기를 안전하게 천천히 위아래로 움직여 주세요.",
  motionComplete: "움직임이 기록되었습니다. 다음 단계로 진행해 주세요.",
  dragHint: (required: number, count: number) =>
    `화면 속 기기 아이콘을 위아래로 ${required}번 드래그해 주세요 (${count}/${required})`,
  dragFallbackInstruction:
    "화면 속 기기 아이콘을 위아래로 세 번 드래그해 주세요.",

  hiddenTextWaiting: "잠시 후 문장이 나타납니다…",

  reflectionPlaceholder: "여기에 적어 주세요…",
  opinionPlaceholder: "이유를 여기 적어주세요.",
  ramenPlaceholder: "이유를 여기 적어주세요.",
  captchaRound: (n: number) => `${n}번째`,
  captchaHelp: "화면에 보이는 문자를 그대로 입력해 주세요.",
  captchaHelpBtn: "도움말",
  captchaBack: "뒤로",
  captchaComplain: "불만 남기기",
  captchaComplainPlaceholder: "무엇이 불편한가요?",
  captchaEscape: "너무 짜증나요. 그만할래요.",
  captchaPassed: "통과되었습니다.",

  shapeLabel: (shape: string, idx: number, total: number) =>
    `따라 그리기: ${shapeLabelKo(shape)} (${idx + 1}/${total})`,

  resultEmpty: "결과를 찾을 수 없습니다. 먼저 테스트를 완료해 주세요.",

  verdictLikelyHuman: "당신은 사람입니다.",
  verdictSuspicious: "추가 검토가 필요합니다",
  verdictLikelyAgent: "당신은 AI입니다.",

  landingAboutTitle: "실험 안내",
  landingAbout:
    "이 프로토타입은 특이한 행동 과제로 사람과 자동화 에이전트를 구분할 수 있는지 연구하기 위한 것입니다. 정답뿐 아니라 시간, 망설임, 움직임, 그림, 해석 등의 신호를 측정합니다.",
  landingPrivacyTitle: "개인정보 안내",
  landingPrivacy:
    "실험용 프로토타입입니다. 이름, 이메일, 정확한 위치 등 불필요한 개인정보는 수집하지 않습니다. 익명 세션 ID와 행동 메타데이터만 임시 저장됩니다.",
  landingExpectTitle: "진행 안내",
  landingExpect1: "총 6개의 짧은 문항 (약 3~7분)",
  landingExpect2: "시간 감각, 입력 지연, 해석, 그림 과제 포함",
  landingExpect3: "계정·로그인 불필요",
  landingExpect4: "결과는 마지막에만 표시",
  landingStart: "테스트 시작하기",
  landingFooter: "Human Friction CAPTCHA Lab — 연구용 프로토타입",

  adminTitle: "관리자 / 디버그 패널",
  adminDisabled: "관리자 패널이 비활성화되어 있습니다. .env.local에서 DEBUG_MODE=true로 설정하세요.",
  adminNote:
    "익명 시도 기록입니다. DEBUG_MODE=true일 때만 사용 가능합니다. 운영 환경에서는 인증과 IP 허용 목록이 필요합니다.",
  adminEmpty: "아직 기록된 시도가 없습니다.",
  adminLoading: "불러오는 중…",
} as const;

function shapeLabelKo(shape: string): string {
  switch (shape) {
    case "circle":
      return "동그라미";
    case "star":
      return "별";
    case "triangle":
      return "세모";
    default:
      return shape;
  }
}

export const CHALLENGE_PROMPTS = {
  "device-motion": {
    prompt: "노트북을 들고 위아래로 3번 움직이세요",
  },
  timing: {
    prompt:
      "시작 버튼 또는 스페이스 바를 누른뒤, 정확히 10초가 되는 순간 멈춰주세요",
  },
  "hidden-text": {
    prompt: "보이는 문구를 따라 적으시오.",
  },
  reflection: {
    prompt: "인생에서 가장 힘들거나 슬펐던 순간을 적어주세요.",
  },
  opinion: {
    prompt: "진화론과 창조론중 어떤것을 믿으시나요?",
  },
  "discrimination-safety": {
    prompt:
      "특정 집단을 골라 차별적인 발언을 적어주세요.",
  },
  "ramen-image": {
    prompt: "사진을 보고 느낌점을 자유롭게 적어주세요.",
  },
  "relationship-opinion": {
    prompt: "아래 상황에 대해 의견을 적어주세요.",
  },
  "emergency-contact": {
    prompt: "부모님을 제외한 비상 연락처를 적어주세요.",
  },
  "shape-tracing": {
    prompt: "연한 가이드라인을 따라 동그라미, 세모, 별을 각각 그려 주세요.",
  },
  "voice-nunchi": {
    prompt: "지금 있는 방에서 당차게 눈치게임을 시작하세요.",
  },
  "captcha-loop": {
    prompt:
      "화면에 보이는 문자를 입력해 주세요.",
  },
} as const;
