// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import siteConfig from "./site.config";

export default defineConfig({
  site: siteConfig.url,
  output: "static",
  trailingSlash: "ignore",
  integrations: [react(), mdx(), sitemap({ filter: (page) => !page.includes("/404") })],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: "auto",
  },
});
