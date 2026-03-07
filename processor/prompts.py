"""
Prompt 模板模組
定義傳送給 vLLM 的提示詞，要求模型輸出標準化 JSON 格式的繁體中文摘要。
"""


SYSTEM_PROMPT = (
    "你是一位專精於教育科技（EdTech）、自主學習（SRL）、專題式學習（PBL）"
    "及學習科學的研究助理。你擅長閱讀英文學術論文或教育新聞，"
    "並將其轉化為結構清晰的繁體中文摘要。\n"
    "請嚴格依照指示輸出合法的 JSON 格式，不要在 JSON 之外輸出任何內容。"
)


def build_analysis_prompt(article: dict) -> str:
    """
    根據文章資訊建立分析提示詞，要求 vLLM 輸出結構化 JSON。

    Args:
        article: 包含 original_title, source_name, original_abstract 的字典

    Returns:
        str: 傳送給模型的 user prompt
    """
    title = article.get("original_title", "（無標題）")
    source = article.get("source_name", "（未知來源）")
    abstract = article.get("original_abstract", "（無摘要）")

    # 截斷過長摘要，避免壓縮模型輸出空間（輸入越短，留給 JSON 輸出的 token 越多）
    abstract_trimmed = abstract[:1500] if len(abstract) > 1500 else abstract

    return f"""請分析以下學術論文或教育科技文章，並以 JSON 格式輸出結構化摘要。

---
文章標題：{title}
來源：{source}
摘要／內容：
{abstract_trimmed}
---

請輸出以下 JSON 格式（所有中文欄位請使用**繁體中文**）：

{{
  "translated_title": "文章的繁體中文標題（自然流暢的翻譯，30字以內）",
  "one_sentence_summary": "用一句話（50字以內）總結這篇文章的核心貢獻或最重要的發現",
  "key_findings": [
    "第一個核心研究發現或重點（30-80字，清楚具體）",
    "第二個核心研究發現或重點（30-80字，清楚具體）",
    "第三個核心研究發現或重點（30-80字，清楚具體）",
    "第四個核心研究發現或重點（30-80字，清楚具體）",
    "第五個核心研究發現或重點（30-80字，清楚具體）"
  ],
  "research_method": "簡述研究方法或資料來源（例如：隨機對照實驗、問卷調查、系統性文獻回顧、案例研究等），60字以內",
  "target_audience": "此研究最適合哪些讀者或實務工作者參考（例如：K-12 教師、高等教育研究者、課程設計者、教育政策制定者等），40字以內",
  "practical_insights": "對實務教育工作者或課程設計者的具體啟發與可行建議（200字以內）",
  "tags": ["english", "keywords", "max5", "relevant", "lowercase"],
  "relevance_score": 7
}}

注意事項：
1. key_findings 必須恰好包含 5 個條目，每個條目獨立成一個有意義的句子
2. research_method 若文章未明確說明方法，請根據內容合理推斷並說明
3. target_audience 請具體指出最受益的受眾群體
4. tags 使用英文小寫，最多 5 個，優先選用：SRL、PBL、AI、edtech、higher education、K-12、assessment、learning design、knowledge building、metacognition 等領域詞彙
5. relevance_score 為 1-10 的整數：評估此文章與「教育科技、學習科學、SRL、PBL」的相關程度（1=完全無關，10=完全切題）
6. 所有中文欄位**必須**使用繁體中文，不得使用簡體
7. 輸出必須是合法的 JSON，不含任何多餘文字或 markdown 程式碼區塊"""
