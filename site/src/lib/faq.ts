import type { FaqItem } from "../data/faq";

export function searchFaq(items: FaqItem[], query: string): FaqItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    `${item.question} ${item.answer} ${item.category}`.toLowerCase().includes(needle),
  );
}
