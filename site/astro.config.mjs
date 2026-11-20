// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import siteConfig from "./site.config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  site: siteConfig.url,
  output: "static",
  trailingSlash: "ignore",
  integrations: [
    react(),
    mdx(),
    sitemap({ filter: (page) => !page.includes("/404") && !page.includes("/account") }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@lyrica/styles": fileURLToPath(new URL("../packages/styles/src/index.ts", import.meta.url)),
      },
    },
  },
  build: {
    inlineStylesheets: "auto",
  },
});
