"""
Prompt 模板模組
定義傳送給 vLLM 的提示詞，要求模型輸出標準化 JSON 格式的繁體中文摘要。
"""

# 統一摘要截斷長度（中文字元數），避免各 prompt 使用不同上限
ABSTRACT_MAX_CHARS = 2500


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

AI_HIGHLIGHTS_SYSTEM_PROMPT = (
  "你是一位擅長幫讀者抓重點的教育科技研究編輯。"
  "你的工作不是重寫全文摘要，而是從既有文章資訊中挑出最值得優先注意的 2-3 個重點，"
  "並清楚說明為什麼這些重點最值得先看。\n"
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
    abstract_trimmed = abstract[:ABSTRACT_MAX_CHARS] if len(abstract) > ABSTRACT_MAX_CHARS else abstract

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
    "文章本身陳述的事實性發現或數據結果（30-80字，清楚具體）",
    "第二個事實性發現（30-80字）",
    "第三個事實性發現（30-80字，若文章內容足夠才需要更多條目）"
  ],
  "ai_highlights": [
    {{
      "point": "AI 認為讀者最該優先注意的洞察或啟發（25-60字）",
      "reason": "說明這個洞察為何重要——它如何改變讀者對該領域的理解或實務做法（40-120字）"
    }},
    {{
      "point": "第二個值得先掌握的洞察（25-60字）",
      "reason": "說明這點為何會影響讀者理解整篇文章或後續應用（40-120字）"
    }}
  ],
  "research_method": "簡述研究方法或資料來源（例如：隨機對照實驗、問卷調查、系統性文獻回顧、案例研究等），60字以內",
  "target_audience": "此研究最適合哪些讀者或實務工作者參考（例如：K-12 教師、高等教育研究者、課程設計者、教育政策制定者等），40字以內",
  "practical_insights": "對實務教育工作者或課程設計者的具體啟發與可行建議（200字以內）",
  "tags": ["english", "keywords", "max5", "relevant", "lowercase"],
  "relevance_score": 7
}}

注意事項：
1. key_findings 包含 3-5 個條目，依據文章實際內容決定數量；每個條目聚焦文章本身的事實、數據或研究結果（What happened）
2. ai_highlights 包含 2-3 個物件，聚焦 AI 對讀者的閱讀建議與洞察（Why it matters）；不可與 key_findings 重複同樣的句子
3. ai_highlights.reason 要回答「為什麼 AI 覺得這是重點」，不可只重複 point 本身
4. research_method 若文章未明確說明方法，請根據內容合理推斷並說明
5. target_audience 請具體指出最受益的受眾群體
6. tags 使用英文小寫，最多 5 個，優先選用：SRL、PBL、AI、edtech、higher education、K-12、assessment、learning design、knowledge building、metacognition 等領域詞彙
7. relevance_score 為 1-10 的整數：評估此文章與「教育科技、學習科學、SRL、PBL」的相關程度（1=完全無關，10=完全切題）
8. 所有中文欄位**必須**使用繁體中文，不得使用簡體
9. 輸出必須是合法的 JSON，不含任何多餘文字或 markdown 程式碼區塊"""


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
        trimmed_content = content[:ABSTRACT_MAX_CHARS] if len(content) > ABSTRACT_MAX_CHARS else content

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


def build_ai_highlights_backfill_prompt(article: dict) -> str:
    """根據既有文章資料，專門生成更完整的 ai_highlights。"""

    original_title = article.get("original_title", "（無標題）")
    translated_title = article.get("translated_title", "（無譯標）")
    source_name = article.get("source_name", "（未知來源）")
    original_abstract = article.get("original_abstract", "（無摘要）")
    one_sentence_summary = article.get("one_sentence_summary", "（無一句摘要）")
    research_method = article.get("research_method", "（未提供）")
    target_audience = article.get("target_audience", "（未提供）")
    practical_insights = article.get("practical_insights", "（未提供）")

    key_findings = article.get("key_findings") or []
    findings_block = "\n".join(
        f"- {str(finding).strip()}" for finding in key_findings if str(finding).strip()
    )
    if not findings_block:
        findings_block = "- （未提供）"

    abstract_trimmed = (
        original_abstract[:ABSTRACT_MAX_CHARS] if len(original_abstract) > ABSTRACT_MAX_CHARS else original_abstract
    )

    return f"""請根據以下已整理好的文章資訊，只產出更精煉、更有判斷力的 AI 重點。

文章原標題：{original_title}
文章譯標：{translated_title}
來源：{source_name}

摘要／內容：
{abstract_trimmed}

一句摘要：
{one_sentence_summary}

核心發現：
{findings_block}

研究方法：
{research_method}

適合讀者：
{target_audience}

實務啟發：
{practical_insights}

請輸出以下 JSON：
{{
  "ai_highlights": [
    {{
      "point": "最值得優先閱讀的重點，25-60 字",
      "reason": "說明為什麼這一點會影響讀者理解整篇文章的價值、方法、結果或實際應用，45-120 字"
    }},
    {{
      "point": "第二個應先掌握的重點，25-60 字",
      "reason": "說明這個重點之所以重要的原因，不能只是換句話重述 point，45-120 字"
    }}
  ]
}}

注意事項：
1. 只能輸出 ai_highlights，不要重複輸出其他欄位。
2. ai_highlights 必須有 2-3 個物件，每個都要包含 point 與 reason。
3. point 要具體，避免空泛形容詞；reason 要講清楚「為什麼值得先看」。
4. 優先挑選最能代表研究方法、主要發現、實際應用價值或讀者決策意義的重點。
5. 所有文字都必須使用繁體中文。
6. 輸出必須是合法 JSON，不含任何多餘文字。"""
