import { describe, expect, it } from "vitest";
import treeData from "../data/troubleshoot.json";

type Leaf = { type: "leaf"; title: string; fix: string; steps: string[]; links: { label: string; href: string }[] };
type Question = {
  type: "question";
  question: string;
  help: string;
  yes?: string;
  no?: string;
  options?: { label: string; next: string }[];
};
type Tree = { start: string; nodes: Record<string, Leaf | Question> };

const tree = treeData as Tree;

describe("troubleshooter tree", () => {
  it("has a valid start node", () => {
    expect(tree.nodes[tree.start]).toBeDefined();
  });

  it("only points at nodes that exist", () => {
    for (const [id, node] of Object.entries(tree.nodes)) {
      if (node.type === "leaf") continue;
      const targets = node.options?.map((option) => option.next) ?? [node.yes, node.no];
      for (const target of targets) {
        expect(target, `${id} has a missing target`).toBeTruthy();
        expect(tree.nodes[target!], `${id} points at missing node ${target}`).toBeDefined();
      }
    }
  });

  it("triages with a question or a fix, never an empty leaf", () => {
    for (const node of Object.values(tree.nodes)) {
      if (node.type === "leaf") {
        expect(node.fix.length).toBeGreaterThan(20);
        expect(node.steps.length).toBeGreaterThan(0);
        expect(node.links.length).toBeGreaterThan(0);
      } else {
        expect(node.question.length).toBeGreaterThan(5);
        expect(node.help.length).toBeGreaterThan(10);
      }
    }
  });

  it("reaches every node from the start", () => {
    const seen = new Set<string>();
    const queue = [tree.start];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = tree.nodes[id];
      if (!node || node.type === "leaf") continue;
      const next = node.options?.map((option) => option.next) ?? [node.yes!, node.no!];
      queue.push(...next);
    }
    expect(seen.size).toBe(Object.keys(tree.nodes).length);
  });
});
