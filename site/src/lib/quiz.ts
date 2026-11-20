import { allStyles, type StyleItem } from "../data/styles";
import { answerTargets, quizQuestions, scoreStyle } from "../data/quiz";

export type QuizResult = { style: StyleItem; score: number };

export function rankStyles(optionIds: string[], limit = 3): QuizResult[] {
  const targets = answerTargets(optionIds);
  return allStyles
    .map((style) => ({ style, score: scoreStyle(style.traits, targets) }))
    .sort((a, b) => b.score - a.score || a.style.slug.localeCompare(b.style.slug))
    .slice(0, limit);
}

export function everyAnswerPathReturnsThree(): boolean {
  const paths = quizQuestions.reduce(
    (count, question) => count * question.options.length,
    1,
  );
  for (let index = 0; index < paths; index += 1) {
    let remaining = index;
    const answers = quizQuestions.map((question) => {
      const option = question.options[remaining % question.options.length];
      remaining = Math.floor(remaining / question.options.length);
      return option.id;
    });
    if (rankStyles(answers).length !== 3) return false;
  }
  return true;
}
