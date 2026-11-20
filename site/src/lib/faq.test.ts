import { describe, expect, it } from "vitest";
import { faqItems } from "../data/faq";
import { searchFaq } from "./faq";

describe("searchFaq", () => {
  it("returns every item for an empty query", () => {
    expect(searchFaq(faqItems, "   ")).toHaveLength(faqItems.length);
  });

  it("matches a player name in an answer", () => {
    const results = searchFaq(faqItems, "cider");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => `${item.question} ${item.answer}`.toLowerCase().includes("cider"))).toBe(true);
  });

  it("matches category text case-insensitively", () => {
    const results = searchFaq(faqItems, "SUPPORT");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.category === "Support")).toBe(true);
  });

  it("returns nothing for an unmatchable query", () => {
    expect(searchFaq(faqItems, "zzzz-not-a-real-answer")).toEqual([]);
  });
});
