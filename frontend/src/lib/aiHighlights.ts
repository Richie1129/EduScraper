import type { AIHighlight, Article } from "@/types/article";

export function deriveAIHighlights(article: Article): AIHighlight[] {
  if (article.ai_highlights && article.ai_highlights.length > 0) {
    return article.ai_highlights;
  }

  const findings = article.key_findings ?? [];
  const sharedReason = article.practical_insights || article.one_sentence_summary;

  return findings.slice(0, 3).map((finding, index) => ({
    point: finding,
    reason:
      index === 0
        ? `AI 將它列為第一層重點，因為它直接呼應本文一句話摘要的主軸：${article.one_sentence_summary}`
        : sharedReason
          ? `AI 判斷這一點重要，因為它不只描述研究結果，還延伸到實務意義：${sharedReason}`
          : `AI 判斷這一點重要，因為它與文章整體主題高度相關，且本篇相關度評分為 ${article.relevance_score}/10。`,
  }));
}