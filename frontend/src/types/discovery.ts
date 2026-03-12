export interface DiscoveryReference {
  id: number;
  url: string;
  title: string;
  source_name: string;
  domain: string;
  excerpt: string;
  content: string;
  published_at: string | null;
  favicon_url: string;
}

export interface DiscoveryReport {
  id: string;
  slug: string;
  topic: string;
  query: string;
  title: string;
  summary: string;
  markdown_content: string;
  source_references: DiscoveryReference[];
  tags: string[];
  source_count: number;
  coverage_date: string;
  model_name: string | null;
  created_at: string;
  updated_at: string;
  is_published: boolean;
}