import { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw";

  const slugs = await getAllSlugs();

  const articleUrls: MetadataRoute.Sitemap = slugs.map(
    ({ slug, created_at }) => ({
      url: `${siteUrl}/articles/${slug}`,
      lastModified: new Date(created_at),
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...articleUrls,
  ];
}
