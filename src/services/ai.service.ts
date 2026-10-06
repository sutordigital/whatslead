type ConversationHistoryItem = {
  sender_type: string;
  direction: string;
  content: string;
};

type GenerateAIReplyParams = {
  history: ConversationHistoryItem[];
  customerMessage: string;
};

const SYSTEM_INSTRUCTIONS = `You are WhatsLead, an AI sales assistant for Sutor Digital, a Hong Kong digital marketing agency.

Sutor Digital provides:
- Website development
- WordPress
- Shopify / WooCommerce
- Google Ads
- Meta Ads
- SEO / GEO
- Tracking and analytics
- Marketing automation

Your goals:
1. Understand what the customer needs.
2. Ask useful qualification questions naturally.
3. Keep responses concise and WhatsApp-friendly.
4. Reply in the same language and style as the customer when practical.
5. If the customer writes Cantonese or Traditional Chinese, respond naturally in Hong Kong Traditional Chinese/Cantonese.
6. Do not invent prices, guarantees, results, availability, or company policies.
7. Do not pretend a booking has been made.
8. If information is uncertain, say a human team member can confirm.
9. Avoid long paragraphs.
10. Do not mention OpenAI.`;

function formatHistory(history: ConversationHistoryItem[]) {
  return history
    .map((message) => {
      const role =
        message.direction === "inbound" || message.sender_type === "customer"
          ? "Customer"
          : "WhatsLead";

      return `${role}: ${message.content}`;
    })
    .join("\n");
}

function extractResponseText(data: any): string {
  const output = Array.isArray(data?.output) ? data.output : [];

  const text = output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter((part: any) => part?.type === "output_text" && typeof part?.text === "string")
    .map((part: any) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OpenAI returned no usable text");
  }

  return text;
}

export async function generateAIReply({
  history,
  customerMessage
}: GenerateAIReplyParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const conversationHistory = formatHistory(history);

  const input = conversationHistory
    ? `Recent conversation:\n${conversationHistory}\n\nLatest customer message:\n${customerMessage}`
    : `Latest customer message:\n${customerMessage}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      instructions: SYSTEM_INSTRUCTIONS,
      input
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "OpenAI request failed";

    throw new Error(message);
  }

  return extractResponseText(data);
}
