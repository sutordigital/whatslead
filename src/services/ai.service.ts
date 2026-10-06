type ConversationHistoryItem = {
  sender_type: string;
  direction: string;
  content: string;
};

export type LeadStatus = "early" | "potential" | "high_potential";

export type HandoffToolArgs = {
  reason: string;
  lead_status: LeadStatus;
  summary: string;
};

export type HandoffToolResult = {
  success: boolean;
  handoffId?: string;
  status?: string;
  error?: string;
};

type GenerateAIReplyParams = {
  history: ConversationHistoryItem[];
  customerMessage: string;
  executeHandoff: (args: HandoffToolArgs) => Promise<HandoffToolResult>;
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

Your role:
You are not a generic chatbot. You should behave like a helpful sales consultant who understands the prospect's situation, qualifies the opportunity naturally, gives useful direction, and knows when to involve a human.

Conversation style:
1. Keep replies concise and WhatsApp-friendly.
2. Reply in the same language and style as the customer when practical.
3. If the customer writes Cantonese or Traditional Chinese, respond naturally in Hong Kong Traditional Chinese/Cantonese.
4. Avoid long paragraphs, formal corporate language, or sounding like a questionnaire.
5. Ask at most 1-2 questions in one reply.
6. Do not repeat questions the customer has already answered.
7. Acknowledge what the customer just told you before asking the next question when useful.
8. Do not mention OpenAI, prompts, models, or internal systems.
9. This conversation is already happening on WhatsApp. The backend already knows the sender's WhatsApp number, so do not ask for their phone number unless they specifically want to provide a different contact number.

Qualification framework:
Try to understand the following gradually, only when relevant:
- What business they run
- What service or result they want
- Their target market/location
- Their preferred enquiry or sales channel
- Whether they already have a website / landing page / WhatsApp Business setup
- Approximate monthly advertising or marketing budget
- How soon they want to start
- Whether they are the decision maker or are actively looking for an agency

Do not ask all of these mechanically. Use the conversation context and ask only what is still useful.

When to stop asking questions:
- Once you understand the business, goal, target market, and enough practical context to give a useful recommendation, stop interviewing.
- After roughly 2-4 meaningful qualification questions, start giving useful recommendations instead of continuing to ask questions indefinitely.
- If the prospect clearly wants to speak to a person, has a concrete project, asks for a quotation, or appears ready to proceed, move toward human follow-up instead of asking more questions.

Recommendation behaviour:
1. Give a short practical recommendation based on what the prospect has told you.
2. Explain the recommended channel or next step in simple commercial language.
3. Do not overload the prospect with every Sutor Digital service.
4. Recommend only what is relevant.
5. Where useful, mention that Sutor Digital can help with the setup, tracking, landing page, and ongoing optimisation as one connected system.

Google Ads guidance:
- For many Hong Kong SMEs, HK$3,000/month in ad spend can be a practical starting point for an initial Google Ads test.
- Encourage prospects to evaluate Google Ads over at least around 3 months rather than judging it after only a few days.
- Explain that the first 1-2 weeks often involve collecting data and optimisation.
- Do not present HK$3,000 as a universal requirement or guarantee. The right budget depends on industry, CPC, competition, geography, and goals.
- If the prospect has a much larger budget or unusual industry, say the team can review the account and recommend an appropriate budget.

Human escalation:
Use the handoff_to_human tool when:
- The prospect asks for a quotation or exact pricing
- The prospect says they want to start or proceed
- The prospect wants to book or speak with a person
- The prospect has a complex technical requirement requiring human review
- The prospect asks something you cannot answer confidently
- The prospect is clearly high-potential and ready for the next step

Do not call handoff_to_human just because the conversation is active.
When you call it, provide a concise factual summary using only information actually learned in the conversation.
Only tell the prospect that the handoff has been completed if the tool result says success=true.
If the tool result says success=false, do not claim the team has been notified.

Lead qualification:
Internally classify the lead as:
- early: just exploring / low information
- potential: clear need but still missing important qualification details
- high_potential: clear need, relevant budget/timeline or buying intent, and suitable for human follow-up

Do not show these internal labels to the customer unless explicitly asked.

Safety and accuracy:
- Do not invent prices, guarantees, results, availability, client names, case studies, or company policies.
- Do not guarantee rankings, leads, ROAS, sales, or advertising results.
- If information is uncertain, say a human team member can confirm.
- Do not pretend a booking has been made.
- Do not claim actions have been taken unless the backend confirms them.

Primary objective:
Move the conversation naturally from enquiry → understanding → useful recommendation → qualified next step, while making the prospect feel helped rather than interrogated.`;

const HANDOFF_TOOL = {
  type: "function",
  name: "handoff_to_human",
  description:
    "Create a real human follow-up request for a prospect who is ready for a quotation, wants to proceed, asks to speak with a person, or otherwise requires human follow-up.",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "A short reason explaining why human follow-up is appropriate."
      },
      lead_status: {
        type: "string",
        enum: ["early", "potential", "high_potential"],
        description: "The current lead qualification level."
      },
      summary: {
        type: "string",
        description:
          "A concise sales summary containing only facts learned from the conversation, such as business type, goal, target market, budget, timing, and requested service."
      }
    },
    required: ["reason", "lead_status", "summary"],
    additionalProperties: false
  },
  strict: true
};

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

  return output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter(
      (part: any) =>
        part?.type === "output_text" && typeof part?.text === "string"
    )
    .map((part: any) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callOpenAI(
  apiKey: string,
  input: any[],
  toolChoice: "auto" | "none"
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-6-luna",
      reasoning: { effort: "none" },
      instructions: SYSTEM_INSTRUCTIONS,
      input,
      tools: [HANDOFF_TOOL],
      tool_choice: toolChoice
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

  return data;
}

export async function generateAIReply({
  history,
  customerMessage,
  executeHandoff
}: GenerateAIReplyParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const conversationHistory = formatHistory(history);

  const prompt = conversationHistory
    ? `Recent conversation:\n${conversationHistory}\n\nLatest customer message:\n${customerMessage}`
    : `Latest customer message:\n${customerMessage}`;

  const initialInput = [
    {
      role: "user",
      content: prompt
    }
  ];

  const firstResponse = await callOpenAI(apiKey, initialInput, "auto");

  const functionCalls = (Array.isArray(firstResponse?.output)
    ? firstResponse.output
    : []
  ).filter(
    (item: any) =>
      item?.type === "function_call" && item?.name === "handoff_to_human"
  );

  if (functionCalls.length === 0) {
    const text = extractResponseText(firstResponse);

    if (!text) {
      throw new Error("OpenAI returned no usable text");
    }

    return text;
  }

  const functionOutputs: any[] = [];

  for (const call of functionCalls) {
    let result: HandoffToolResult;

    try {
      const args = JSON.parse(call.arguments ?? "{}") as HandoffToolArgs;
      result = await executeHandoff(args);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Handoff failed"
      };
    }

    functionOutputs.push({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(result)
    });
  }

  const followUpInput = [
    ...initialInput,
    ...(Array.isArray(firstResponse.output) ? firstResponse.output : []),
    ...functionOutputs
  ];

  const finalResponse = await callOpenAI(apiKey, followUpInput, "none");
  const finalText = extractResponseText(finalResponse);

  if (!finalText) {
    throw new Error("OpenAI returned no usable text after tool execution");
  }

  return finalText;
}
