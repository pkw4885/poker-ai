"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

type Locale = "ko" | "en";

const translations = {
  // Nav
  "nav.guide": { ko: "가이드", en: "Guide" },
  "nav.play": { ko: "플레이", en: "Play" },

  // Home page
  "home.subtitle": { ko: "텍사스 홀덤 AI 시스템", en: "Texas Hold'em AI System" },
  "home.title": { ko: "POKER AI", en: "POKER AI" },
  "home.tagline": { ko: "WSOP 룰 · GTO+ 전략 · 자가 학습", en: "WSOP Rules · GTO+ Strategy · Self-Improving" },
  "home.card1.title": { ko: "가이드", en: "Guide" },
  "home.card1.desc": {
    ko: "프리플랍 및 이후 상황별 최적 액션 추천",
    en: "Situation-based optimal action recommendations for preflop and beyond.",
  },
  "home.card2.title": { ko: "AI 대전", en: "Play vs AI" },
  "home.card2.desc": {
    ko: "1~7명의 AI 상대와 난이도를 조절하여 대결",
    en: "Challenge 1-7 AI opponents with adjustable difficulty levels.",
  },
  "home.card3.title": { ko: "ParkPoker", en: "ParkPoker" },
  "home.card3.desc": { ko: "엘리트 AI 1v1 — 출시 예정", en: "Elite AI 1v1 — Coming Soon" },
  "home.footer": { ko: "CFR + Deep RL 기반", en: "Built with CFR + Deep RL" },

  // Guide page
  "guide.title": { ko: "포커 시튜에이션 분석기", en: "Poker Situation Analyzer" },
  "guide.subtitle": { ko: "상황을 입력하면 최적의 액션을 추천합니다", en: "Input your situation for optimal action recommendations" },
  "guide.position": { ko: "포지션", en: "Position" },
  "guide.yourCards": { ko: "핸드 카드", en: "Your Hand" },
  "guide.selectPrompt": {
    ko: "추천을 보려면 카드 2장을 선택하세요 (0장 = 범위 조언)",
    en: "Select 2 cards for recommendation (0 = range advice)",
  },
  "guide.clearCards": { ko: "초기화", en: "Clear" },

  // Game Context
  "guide.gameContext": { ko: "게임 컨텍스트", en: "Game Context" },
  "guide.effectiveStack": { ko: "유효 스택", en: "Effective Stack" },
  "guide.numPlayers": { ko: "플레이어 수", en: "Number of Players" },
  "guide.bbSize": { ko: "빅블라인드 크기", en: "Big Blind Size" },

  // Pre-Action
  "guide.preAction": { ko: "프리액션", en: "Pre-Action" },
  "guide.unopened": { ko: "폴드됨 (오픈 기회)", en: "Unopened" },
  "guide.limped": { ko: "림프", en: "Limped" },
  "guide.singleRaise": { ko: "싱글 레이즈", en: "Single Raise" },
  "guide.threeBet": { ko: "3-Bet", en: "3-Bet" },
  "guide.fourBetPlus": { ko: "4-Bet+", en: "4-Bet+" },
  "guide.raiseSize": { ko: "레이즈 사이즈", en: "Raise Size" },
  "guide.numCallers": { ko: "콜러 수", en: "Number of Callers" },

  // Opponent Profile
  "guide.opponentProfile": { ko: "상대 성향", en: "Opponent Profile" },
  "guide.style": { ko: "스타일", en: "Style" },
  "guide.tight_passive": { ko: "타이트-패시브 (Rock)", en: "Tight-Passive (Rock)" },
  "guide.tight_aggressive": { ko: "타이트-어그레시브 (TAG)", en: "Tight-Aggressive (TAG)" },
  "guide.loose_passive": { ko: "루즈-패시브 (콜링스테이션)", en: "Loose-Passive (Calling Station)" },
  "guide.loose_aggressive": { ko: "루즈-어그레시브 (LAG)", en: "Loose-Aggressive (LAG)" },
  "guide.skillLevel": { ko: "스킬 레벨", en: "Skill Level" },
  "guide.skillLow": { ko: "낮음", en: "Low" },
  "guide.skillMedium": { ko: "보통", en: "Medium" },
  "guide.skillHigh": { ko: "높음", en: "High" },

  // Street & Board
  "guide.streetBoard": { ko: "스트릿 & 보드", en: "Street & Board" },
  "guide.street": { ko: "스트릿", en: "Street" },
  "guide.preflop": { ko: "프리플랍", en: "Preflop" },
  "guide.flop": { ko: "플랍", en: "Flop" },
  "guide.turn": { ko: "턴", en: "Turn" },
  "guide.river": { ko: "리버", en: "River" },
  "guide.boardCards": { ko: "커뮤니티 카드", en: "Board Cards" },
  "guide.boardTexture": { ko: "보드 텍스쳐", en: "Board Texture" },
  "guide.texture.dry": { ko: "드라이", en: "Dry" },
  "guide.texture.wet": { ko: "웻", en: "Wet" },
  "guide.texture.monotone": { ko: "모노톤", en: "Monotone" },
  "guide.texture.paired": { ko: "페어드", en: "Paired" },
  "guide.texture.connected": { ko: "커넥티드", en: "Connected" },
  "guide.texture.highCard": { ko: "하이카드", en: "High" },
  "guide.texture.lowCard": { ko: "로우카드", en: "Low" },
  "guide.texture.rainbow": { ko: "레인보우", en: "Rainbow" },
  "guide.texture.twoTone": { ko: "투톤", en: "Two-tone" },

  // Recommendation output
  "guide.situationSummary": { ko: "시튜에이션 요약", en: "Situation Summary" },
  "guide.recommendedAction": { ko: "추천 액션", en: "Recommended Action" },
  "guide.actionBreakdown": { ko: "액션 비율", en: "Action Breakdown" },
  "guide.reasoning": { ko: "판단 근거", en: "Reasoning" },
  "guide.sizingGuide": { ko: "사이징 가이드", en: "Sizing Guide" },
  "guide.rangeAdvice": { ko: "범위 조언", en: "Range Advice" },
  "guide.analyze": { ko: "분석", en: "Analyze" },

  // Action labels for breakdown
  "guide.action.raise": { ko: "레이즈", en: "Raise" },
  "guide.action.call": { ko: "콜", en: "Call" },
  "guide.action.fold": { ko: "폴드", en: "Fold" },
  "guide.action.threeBet": { ko: "3-Bet", en: "3-Bet" },
  "guide.action.fourBet": { ko: "4-Bet", en: "4-Bet" },
  "guide.action.check": { ko: "체크", en: "Check" },
  "guide.action.bet": { ko: "벳", en: "Bet" },
  "guide.action.checkRaise": { ko: "체크레이즈", en: "Check-Raise" },
  "guide.action.allIn": { ko: "올인", en: "All-In" },
  "guide.action.pushFold": { ko: "푸시/폴드", en: "Push/Fold" },

  // Stack depth labels
  "guide.pushFoldZone": { ko: "푸시/폴드 존", en: "Push/Fold Zone" },
  "guide.shortStack": { ko: "숏 스택", en: "Short Stack" },
  "guide.midStack": { ko: "미드 스택", en: "Mid Stack" },
  "guide.deepStack": { ko: "딥 스택", en: "Deep Stack" },
  "guide.veryDeep": { ko: "매우 딥", en: "Very Deep" },

  // Position descriptions
  "pos.UTG": { ko: "언더더건", en: "Under the Gun" },
  "pos.MP": { ko: "미들", en: "Middle Position" },
  "pos.CO": { ko: "컷오프", en: "Cutoff" },
  "pos.BTN": { ko: "버튼(딜러)", en: "Button (Dealer)" },
  "pos.SB": { ko: "스몰블라인드", en: "Small Blind" },
  "pos.BB": { ko: "빅블라인드", en: "Big Blind" },

  // Tier names
  "tier.Premium": { ko: "프리미엄", en: "Premium" },
  "tier.Strong": { ko: "강함", en: "Strong" },
  "tier.Solid": { ko: "견고", en: "Solid" },
  "tier.Marginal": { ko: "보통", en: "Marginal" },
  "tier.Speculative": { ko: "투기적", en: "Speculative" },
  "tier.Weak": { ko: "약함", en: "Weak" },

  // Action names
  "action.RAISE": { ko: "레이즈", en: "RAISE" },
  "action.RAISE / CALL": { ko: "레이즈 / 콜", en: "RAISE / CALL" },
  "action.CALL / FOLD": { ko: "콜 / 폴드", en: "CALL / FOLD" },
  "action.RAISE / FOLD": { ko: "레이즈 / 폴드", en: "RAISE / FOLD" },
  "action.CHECK / FOLD": { ko: "체크 / 폴드", en: "CHECK / FOLD" },
  "action.FOLD": { ko: "폴드", en: "FOLD" },

  // Recommendation reasoning
  "reason.premium": {
    ko: "프리미엄 핸드. 어떤 포지션에서든 레이즈. 상대 레이즈 시 3-bet.",
    en: "Premium hand. Raise from any position. 3-bet if facing a raise.",
  },
  "reason.strong": {
    ko: "강한 핸드. 어떤 포지션에서든 오픈 레이즈. 상대 레이즈 시 콜 또는 3-bet.",
    en: "Strong hand. Open raise from any position. Call or 3-bet vs a raise.",
  },
  "reason.solid.early": {
    ko: "견고한 핸드. 얼리 포지션에서 오픈 레이즈. 포지션이 있으면 레이즈에 콜.",
    en: "Solid hand. Open raise from early position. Call a raise with position.",
  },
  "reason.solid.late": {
    ko: "레이트 포지션의 견고한 핸드. 밸류 레이즈.",
    en: "Solid hand in late position. Raise for value.",
  },
  "reason.smallpair.early": {
    ko: "스몰 페어. 적당한 가격이면 셋마이닝, 큰 레이즈에는 폴드.",
    en: "Small pair. Set-mine if the price is right, fold to large raises.",
  },
  "reason.smallpair.late": {
    ko: "포지션 있는 스몰 페어. 스틸 레이즈 또는 셋마이닝 콜 가능.",
    en: "Small pair in position. Can raise to steal or call to set-mine.",
  },
  "reason.suited.late": {
    ko: "포지션 있는 수티드 핸드. 플랍 이후 플레이어빌리티 좋음.",
    en: "Suited hand in position. Good playability post-flop.",
  },
  "reason.weak.early": {
    ko: "얼리 포지션의 약한 핸드. 폴드하고 더 좋은 기회를 기다리세요.",
    en: "Weak hand in early position. Fold and wait for better spots.",
  },
  "reason.marginal.late": {
    ko: "보통 핸드. 오픈되지 않았으면 레이트 포지션에서 블라인드 스틸 가능.",
    en: "Marginal hand. Can steal blinds in late position if unopened.",
  },
  "reason.weak.blinds": {
    ko: "빅블라인드에서 가능하면 체크, 레이즈에는 폴드.",
    en: "Check from the big blind if possible, fold to raises.",
  },
  "reason.weak.default": {
    ko: "공격에 폴드, 신중하게 플레이.",
    en: "Fold to aggression, play cautiously.",
  },

  // Common
  "common.back": { ko: "뒤로", en: "Back" },
  "common.selected": { ko: "선택됨", en: "SELECTED" },
  "common.confidence": { ko: "신뢰도", en: "Confidence" },

  // Play page - lobby
  "play.title": { ko: "AI 대전", en: "Play vs AI" },
  "play.configure": { ko: "게임 설정을 구성하세요", en: "Configure your game settings" },
  "play.opponents": { ko: "상대", en: "Opponents" },
  "play.difficulty": { ko: "난이도", en: "Difficulty" },
  "play.easy": { ko: "쉬움", en: "easy" },
  "play.medium": { ko: "보통", en: "medium" },
  "play.hard": { ko: "어려움", en: "hard" },
  "play.startGame": { ko: "게임 시작", en: "Start Game" },
  "play.creating": { ko: "생성 중...", en: "Creating..." },

  // Play page - game
  "play.handResult": { ko: "핸드 결과", en: "Hand Result" },
  "play.wonByFold": { ko: "폴드 승리", en: "Won by fold" },
  "play.nextHand": { ko: "다음 핸드", en: "Next Hand" },
  "play.you": { ko: "나", en: "You" },

  // Action panel
  "action.fold": { ko: "폴드", en: "Fold" },
  "action.check": { ko: "체크", en: "Check" },
  "action.call": { ko: "콜", en: "Call" },
  "action.raise": { ko: "레이즈", en: "Raise" },
  "action.allIn": { ko: "올인", en: "All In" },
  "action.waiting": { ko: "상대 차례 대기 중", en: "Waiting for opponents" },

  // Poker table
  "table.hand": { ko: "핸드", en: "Hand" },

  // Phase labels
  "phase.waiting": { ko: "대기", en: "Waiting" },
  "phase.deal_hole": { ko: "딜링", en: "Dealing" },
  "phase.preflop_bet": { ko: "프리플랍", en: "Pre-Flop" },
  "phase.flop_bet": { ko: "플랍", en: "Flop" },
  "phase.turn_bet": { ko: "턴", en: "Turn" },
  "phase.river_bet": { ko: "리버", en: "River" },
  "phase.showdown": { ko: "쇼다운", en: "Showdown" },
  "phase.hand_over": { ko: "핸드 종료", en: "Hand Over" },

  // Player seat
  "seat.you": { ko: "나", en: "You" },
  "seat.fold": { ko: "폴드", en: "FOLD" },
  "seat.allIn": { ko: "올인", en: "ALL IN" },

  // Pot display
  "pot.label": { ko: "팟", en: "Pot" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("poker-locale");
    if (stored === "ko" || stored === "en") {
      setLocaleState(stored);
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("poker-locale", newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string): string => {
      const entry = translations[key as TranslationKey];
      if (!entry) return key;
      return entry[locale];
    },
    [locale]
  );

  if (!hydrated) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
      className="border border-[#333] text-[10px] tracking-wider px-2 py-1 text-[#666] hover:text-white hover:border-[#555] transition-colors uppercase"
    >
      {locale === "ko" ? "KO" : "EN"}
    </button>
  );
}
