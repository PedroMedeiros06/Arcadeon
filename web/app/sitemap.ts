import type { MetadataRoute } from "next";
import { games } from "@/lib/games";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...games
      .filter((g) => g.status === "available")
      .map((g) => ({
        url: `${SITE_URL}/games/${g.slug}`,
        lastModified: now,
        // o Letrado muda todo dia (palavra do dia)
        changeFrequency: g.slug === "termo" ? ("daily" as const) : ("weekly" as const),
        priority: 0.9,
      })),
    { url: `${SITE_URL}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];
}
