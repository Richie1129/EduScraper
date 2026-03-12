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

DISCOVERY_SYSTEM_PROMPT = (
    "你是一位專業的科技新聞編輯，專長是將多篇教育科技新聞整理成可驗證的綜合報導。\n"
    "你只能使用提供的參考資料，不可引入外部知識，不可補寫未被來源支持的細節。\n"
    "你輸出的每一個完整句子都必須附上來源編號，例如 [1] 或 [2][4]。\n"
    "你的寫作目標不是極短摘要，而是把同一天的重要脈絡、差異與可能走向講清楚。\n"
    "請嚴格輸出合法 JSON，不要輸出任何 JSON 以外的內容。"
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


def build_discovery_prompt(topic: str, query: str, sources: list[dict]) -> str:
    """根據多個來源建立引用式新聞統整 Prompt。"""

    source_blocks: list[str] = []
    for source in sources:
        source_id = source.get("id")
        title = source.get("title", "（無標題）")
        url = source.get("url", "")
        source_name = source.get("source_name", "（未知來源）")
        excerpt = source.get("excerpt", "（無摘錄）")
        content = source.get("content", "（無內容）")
        trimmed_content = content[:1800] if len(content) > 1800 else content

        source_blocks.append(
            f"""[{source_id}]
URL: {url}
標題: {title}
來源: {source_name}
摘錄: {excerpt}
內容: {trimmed_content}
"""
        )

    joined_sources = "\n---\n".join(source_blocks)

    return f"""請根據以下參考資料，撰寫一篇繁體中文的教育科技新聞統整。

主題：{topic}
搜尋查詢：{query}

規則：
1. 只能使用參考資料中出現的資訊，不可捏造、推測或補充未被來源支持的內容。
2. 每一個完整句子都必須附上來源編號，格式為 [1] 或 [1][3]。
3. 若兩個來源提供互補資訊，可以同時標註多個來源。
4. 文章使用 Markdown，需有清楚的小標題。
5. 標題、摘要、內文都必須使用繁體中文。
6. 若來源之間存在不一致，必須明確指出差異並標註來源。
7. 不要把文章寫成過短的新聞摘錄；要整理出脈絡、比較與影響。
8. `## 今日重點` 必須至少涵蓋 3 個重點，每個重點至少 2 句，說清楚事件內容、涉及對象或產品、以及它為何值得注意。
9. `## 趨勢觀察` 必須至少寫 3 個段落，每段至少 2 句，分析這些消息共同反映出的產業方向、落地挑戰、受影響角色或接下來值得追蹤的變化。
10. 若資料足夠，優先指出來源之間的共同點、差異點、節奏快慢與可能的風險訊號，而不只是重複摘錄。
11. 內文總長度以 700-1200 字為目標，內容密度要高，但不得脫離來源。

請輸出以下 JSON：

{{
  "title": "新聞統整標題，20-32 字",
  "summary": "2 句內的整體摘要，且每句都要有來源標註",
    "markdown_content": "完整 Markdown 文章，至少包含 ## 今日重點 與 ## 趨勢觀察 兩個段落；今日重點需有至少 3 個重點，趨勢觀察需有至少 3 個分析段落，且每句都要有來源標註",
  "tags": ["edtech", "ai", "assessment"]
}}

參考資料：
{joined_sources}
"""
