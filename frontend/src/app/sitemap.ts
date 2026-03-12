import { MetadataRoute } from "next";
import { getAllDiscoverySlugs, getAllSlugs } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw";

  const slugs = await getAllSlugs();
  const discoverySlugs = await getAllDiscoverySlugs();

  const articleUrls: MetadataRoute.Sitemap = slugs.map(
    ({ slug, created_at }) => ({
      url: `${siteUrl}/articles/${slug}`,
      lastModified: new Date(created_at),
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  const discoveryUrls: MetadataRoute.Sitemap = discoverySlugs.map(
    ({ slug, updated_at }) => ({
      url: `${siteUrl}/discoveries/${slug}`,
      lastModified: new Date(updated_at),
      changeFrequency: "daily",
      priority: 0.8,
    })
  );

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/discoveries`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...articleUrls,
    ...discoveryUrls,
  ];
}
