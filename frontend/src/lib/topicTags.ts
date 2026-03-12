export interface TopicTagLink {
  href: string;
  label: string;
  value: string;
}

export interface PopularTopicTag extends TopicTagLink {
  count: number;
}

const TOPIC_LABELS: Record<string, string> = {
  edtech: "教育科技 (EdTech)",
  "learning design": "學習設計",
  ai: "AI 教育應用",
  "higher education": "高等教育",
  srl: "自主學習 (SRL)",
  assessment: "學習評量",
  "knowledge building": "知識翻新",
  metacognition: "後設認知",
  "k-12": "K-12 教育",
  "human-computer interaction": "人機互動",
  accessibility: "無障礙設計",
  privacy: "隱私",
  security: "資安",
  collaboration: "協作學習",
  creativity: "創造力",
  motivation: "學習動機",
  ethics: "AI 倫理",
  governance: "治理",
  bias: "偏誤",
  vr: "虛擬實境",
  technology: "科技應用",
  research: "研究方法",
  training: "培訓",
  leadership: "領導力",
  "cognitive science": "認知科學",
  compliance: "法規遵循",
  hr: "人資",
  "l&d": "學習與發展",
  "social media": "社群媒體",
};

function fallbackTopicLabel(value: string): string {
  if (value === value.toUpperCase()) return value;

  return value
    .split(/\s+/)
    .map((segment) => {
      if (segment.includes("-")) {
        return segment
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

export function getTopicHref(value: string): string {
  return `/?tag=${encodeURIComponent(value)}`;
}

export function getTopicLabel(value: string): string {
  return TOPIC_LABELS[value] ?? fallbackTopicLabel(value);
}

export function buildPopularTopicTag(value: string, count: number): PopularTopicTag {
  return {
    value,
    count,
    label: getTopicLabel(value),
    href: getTopicHref(value),
  };
}

export const TOPIC_TAG_LINKS: TopicTagLink[] = [
  buildPopularTopicTag("edtech", 0),
  buildPopularTopicTag("learning design", 0),
  buildPopularTopicTag("ai", 0),
  buildPopularTopicTag("higher education", 0),
  buildPopularTopicTag("srl", 0),
  buildPopularTopicTag("assessment", 0),
  buildPopularTopicTag("knowledge building", 0),
  buildPopularTopicTag("metacognition", 0),
  buildPopularTopicTag("k-12", 0),
  buildPopularTopicTag("human-computer interaction", 0),
];

export const PRIMARY_TOPIC_TAGS = TOPIC_TAG_LINKS.slice(0, 8);