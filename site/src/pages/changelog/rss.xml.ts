import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import siteConfig from "../../../site.config";

export async function GET(context: APIContext) {
  const releases = (await getCollection("changelog")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: `${siteConfig.name} — Changelog`,
    description: "Every Lyrica release, what changed and when.",
    site: context.site ?? siteConfig.url,
    items: releases.map((release) => ({
      title: `v${release.data.version} — ${release.data.title}`,
      description: release.data.summary,
      pubDate: release.data.date,
      link: `/changelog/#${release.data.version}`,
    })),
    customData: "<language>en-us</language>",
  });
}
