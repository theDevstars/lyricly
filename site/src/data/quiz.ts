import type { StyleMood, StyleTraits } from "@lyrica/styles";

export type QuizTarget = Partial<
  Pick<StyleTraits, "energy" | "motion" | "density" | "vividness" | "screenFit">
> & {
  moods?: StyleMood[];
  motionTags?: StyleTraits["motionTags"];
  desks?: StyleTraits["desks"];
};

export type QuizOption = {
  id: string;
  label: string;
  copy: string;
  glyph: string;
  target: QuizTarget;
};

export type QuizQuestion = {
  id: string;
  question: string;
  hint: string;
  options: QuizOption[];
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "music",
    question: "What is on repeat right now?",
    hint: "There is no wrong answer; the styles do different jobs.",
    options: [
      { id: "quiet", label: "Quiet and acoustic", copy: "Soft rooms, soft edges.", glyph: "◌", target: { moods: ["calm", "romantic"], energy: 1, motion: 1 } },
      { id: "late", label: "Late-night and moody", copy: "Headphones after midnight.", glyph: "☾", target: { moods: ["moody", "nostalgic"], energy: 2, motion: 2 } },
      { id: "bright", label: "Bright and melodic", copy: "Windows down, volume up.", glyph: "✺", target: { moods: ["bright", "romantic"], energy: 3, vividness: 4 } },
      { id: "loud", label: "Loud and fast", copy: "The kind of track that moves furniture.", glyph: "↯", target: { moods: ["energetic", "experimental"], energy: 5, motion: 5 } },
      { id: "strange", label: "Strange and textural", copy: "Glitches, field recordings, odd time.", glyph: "⌁", target: { moods: ["experimental", "moody"], energy: 3, vividness: 5 } },
    ],
  },
  {
    id: "desk",
    question: "What does your desk look like?",
    hint: "Pick the closest, not the aspirational one.",
    options: [
      { id: "minimal", label: "Almost empty", copy: "One screen, one cup, no clutter.", glyph: "▭", target: { desks: ["minimal"], density: 1, screenFit: "compact" } },
      { id: "cozy", label: "Warm and lived-in", copy: "A lamp, a plant, a used notebook.", glyph: "❋", target: { desks: ["cozy"], density: 2, screenFit: "balanced" } },
      { id: "rgb", label: "A little arcade", copy: "LED strips and a mechanical keyboard.", glyph: "◈", target: { desks: ["rgb"], vividness: 5, energy: 4 } },
      { id: "cinema", label: "A tiny cinema", copy: "Big display, dim room, good speakers.", glyph: "▣", target: { desks: ["cinematic"], screenFit: "immersive", density: 3 } },
      { id: "work", label: "A working desk", copy: "Tabs open, notes everywhere, deadline nearby.", glyph: "⌘", target: { desks: ["productive"], density: 3, screenFit: "compact" } },
    ],
  },
  {
    id: "screens",
    question: "How many screens are in front of you?",
    hint: "A style that reads well across a desk is different from one big frame.",
    options: [
      { id: "one", label: "Just one", copy: "Everything happens here.", glyph: "▯", target: { screenFit: "compact", density: 2 } },
      { id: "two", label: "Two", copy: "One for work, one for everything else.", glyph: "▯▯", target: { screenFit: "balanced", density: 3 } },
      { id: "three", label: "Three or more", copy: "A wall of glass.", glyph: "▯▯▯", target: { screenFit: "immersive", density: 4, motion: 1 } },
    ],
  },
  {
    id: "motion",
    question: "How much should the words move?",
    hint: "Every style respects reduced motion in the app and on this site.",
    options: [
      { id: "still", label: "Barely at all", copy: "I want to read, not watch.", glyph: "—", target: { motion: 1, motionTags: ["ambient", "ui"], energy: 1 } },
      { id: "gentle", label: "A gentle drift", copy: "Enough to feel alive.", glyph: "∿", target: { motion: 2, motionTags: ["ambient", "type"], energy: 2 } },
      { id: "moving", label: "Properly moving", copy: "Type should dance with the vocal.", glyph: "≈", target: { motion: 4, motionTags: ["type", "kinetic"], energy: 3 } },
      { id: "wild", label: "All of it", copy: "I want the screen to earn its keep.", glyph: "✷", target: { motion: 5, motionTags: ["kinetic", "scene"], energy: 5 } },
    ],
  },
  {
    id: "mood",
    question: "Pick the feeling you want on screen.",
    hint: "This is the last one.",
    options: [
      { id: "calm", label: "Calm", copy: "Like a long exhale.", glyph: "○", target: { moods: ["calm"], energy: 1, vividness: 1 } },
      { id: "romantic", label: "Romantic", copy: "Soft light, close focus.", glyph: "♡", target: { moods: ["romantic", "nostalgic"], energy: 2, vividness: 3 } },
      { id: "nostalgic", label: "Nostalgic", copy: "A memory with the edges worn.", glyph: "◷", target: { moods: ["nostalgic"], energy: 2, vividness: 2 } },
      { id: "energetic", label: "Energised", copy: "Ready to start something.", glyph: "↑", target: { moods: ["energetic", "bright"], energy: 5, vividness: 5 } },
      { id: "experimental", label: "Curious", copy: "Show me something I have not seen.", glyph: "✦", target: { moods: ["experimental"], energy: 3, vividness: 4 } },
    ],
  },
];

const numericKeys = ["energy", "motion", "density", "vividness"] as const;

/**
 * Returns a score for one style against the chosen options. The scoring is
 * generic, so a newly registered style enters the quiz automatically.
 */
export function scoreStyle(
  traits: StyleTraits,
  answers: QuizTarget[],
): number {
  let score = 0;
  for (const target of answers) {
    for (const key of numericKeys) {
      const wanted = target[key];
      if (typeof wanted === "number") score += (5 - Math.abs(traits[key] - wanted)) * 2;
    }
    if (target.screenFit) score += traits.screenFit === target.screenFit ? 5 : 0;
    if (target.moods) {
      score += target.moods.filter((mood) => traits.moods.includes(mood)).length * 4;
    }
    if (target.motionTags) {
      score += target.motionTags.filter((tag) => traits.motionTags.includes(tag)).length * 3;
    }
    if (target.desks) {
      score += target.desks.filter((desk) => traits.desks.includes(desk)).length * 4;
    }
  }
  return score;
}

export const answerTargets = (optionIds: string[]): QuizTarget[] =>
  optionIds
    .map((id) => quizQuestions.flatMap((question) => question.options).find((option) => option.id === id))
    .filter((option): option is QuizOption => Boolean(option))
    .map((option) => option.target);
