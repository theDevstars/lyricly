import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tag: z.string().default("Notes"),
    readingTime: z.string(),
  }),
});

const changelog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/changelog" }),
  schema: z.object({
    version: z.string(),
    date: z.coerce.date(),
    title: z.string(),
    summary: z.string(),
    isNew: z.boolean().default(false),
    sections: z.array(
      z.object({
        label: z.enum(["New", "Improved", "Fixed"]),
        items: z.array(z.string()),
      }),
    ),
  }),
});

export const collections = { blog, changelog };
