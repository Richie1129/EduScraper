export interface AIHighlight {
  point: string;
  reason: string;
}

export interface Article {
  id: string;
  slug: string;
  original_title: string;
  translated_title: string;
  source_url: string;
  source_name: string;
  authors: string[];
  original_abstract: string;
  one_sentence_summary: string;
  key_findings: string[];
  ai_highlights?: AIHighlight[];
  practical_insights: string;
  research_method: string | null;
  target_audience: string | null;
  tags: string[];
  relevance_score: number;
  model_name: string | null;
  published_at: string;
  processed_at: string;
  created_at: string;
  is_published: boolean;
}

export interface ArticleListResult {
  articles: Article[];
  total: number;
}

export interface SearchResultItem {
  id: string;
  slug: string;
  original_title: string;
  translated_title: string;
  source_url: string;
  source_name: string;
  one_sentence_summary: string;
  tags: string[];
  relevance_score: number;
  created_at: string;
  search_rank: number;
}

export interface SearchResult {
  results: SearchResultItem[];
  total: number;
}
