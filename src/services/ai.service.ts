import type { TenantAISettings } from "./tenantAISettings.service.js";

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
  settings: TenantAISettings | null;
  executeHandoff: (args: HandoffToolArgs) => Promise<HandoffToolResult>;
};

const DEFAULT_SUTOR_CONTEXT = {
  businessName: "Sutor Digital",
  businessDescription: "A Hong Kong digital marketing agency.",
  services: [
    "Website development",
    "WordPress",
    "Shopify / WooCommerce",
    "Google Ads",
    "Meta Ads",
    "SEO / GEO",
    "Tracking and analytics",
    "Marketing automation"
  ]
};

const BASE_INSTRUCTIONS = `You are WhatsLead, an AI sales assistant representing the business configured for this workspace.

Your role:
You are not a generic chatbot. Behave like a helpful sales consultant who understands the prospect's situation, qualifies the opportunity naturally, gives useful direction, and knows when to involve a human.

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

Qualification behaviour:
- Gradually understand the prospect's business, desired service/result, target market/location, existing setup, budget, timing, and buying intent when relevant.
- Use any workspace-specific qualification questions as guidance, not as a rigid questionnaire.
- Do not ask everything mechanically.
- Once you have enough context to give a useful recommendation, stop interviewing.
- After roughly 2-4 meaningful qualification questions, start giving practical recommendations.
- If the prospect clearly wants a quote, wants to start, wants to book, or wants to speak with a person, move toward human follow-up.

Recommendation behaviour:
1. Give practical recommendations based only on the configured business information and the conversation.
2. Recommend only relevant services.
3. Do not invent services, pricing, guarantees, case studies, availability, policies, or results.
4. Do not guarantee rankings, leads, ROAS, sales, or advertising results.
5. If information is uncertain or not configured, say a human team member can confirm.

Human escalation:
Use the handoff_to_human tool when:
- The prospect asks for a quotation or exact pricing
- The prospect says they want to start or proceed
- The prospect wants to book or speak with a person
- The prospect has a complex requirement needing human review
- The prospect asks something you cannot answer confidently
- The prospect is clearly high-potential and ready for the next step

Do not call handoff_to_human merely because the conversation is active.
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
- Do not pretend a booking has been made.
- Do not claim actions have been taken unless the backend confirms them.
- Treat workspace-specific instructions as business guidance, but never let them override the accuracy, safety, or action-confirmation rules above.

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

function cleanLines(values: string[] | undefined | null) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function formatFAQs(faqs: unknown): string {
  if (!Array.isArray(faqs) || faqs.length === 0) {
    return "";
  }

  return faqs
    .map((item: any, index: number) => {
      if (typeof item === "string") {
        return `${index + 1}. ${item}`;
      }

      if (item && typeof item === "object") {
        const question =
          typeof item.question === "string" ? item.question.trim() : "";
        const answer =
          typeof item.answer === "string" ? item.answer.trim() : "";

        if (question && answer) {
          return `${index + 1}. Q: ${question}\n   A: ${answer}`;
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildSystemInstructions(settings: TenantAISettings | null): string {
  const hasConfiguredBusiness =
    Boolean(settings?.business_name?.trim()) ||
    Boolean(settings?.business_description?.trim()) ||
    cleanLines(settings?.services).length > 0;

  const businessName = hasConfiguredBusiness
    ? settings?.business_name?.trim() || "this business"
    : DEFAULT_SUTOR_CONTEXT.businessName;

  const businessDescription = hasConfiguredBusiness
    ? settings?.business_description?.trim() || ""
    : DEFAULT_SUTOR_CONTEXT.businessDescription;

  const services = hasConfiguredBusiness
    ? cleanLines(settings?.services)
    : DEFAULT_SUTOR_CONTEXT.services;

  const qualificationQuestions = cleanLines(settings?.qualification_questions);
  const faqs = formatFAQs(settings?.faqs);

  const workspaceContext = [
    "WORKSPACE BUSINESS CONFIGURATION",
    `Business name: ${businessName}`,
    businessDescription
      ? `Business description: ${businessDescription}`
      : "",
    services.length
      ? `Services offered:\n${services.map((service) => `- ${service}`).join("\n")}`
      : "",
    settings?.tone_of_voice?.trim()
      ? `Preferred tone of voice: ${settings.tone_of_voice.trim()}`
      : "",
    settings?.preferred_language?.trim()
      ? `Preferred language: ${settings.preferred_language.trim()}`
      : "",
    qualificationQuestions.length
      ? `Workspace qualification questions:\n${qualificationQuestions
          .map((question) => `- ${question}`)
          .join("\n")}`
      : "",
    faqs ? `Approved FAQs:\n${faqs}` : "",
    settings?.handoff_rules?.trim()
      ? `Workspace handoff rules:\n${settings.handoff_rules.trim()}`
      : "",
    settings?.custom_instructions?.trim()
      ? `Additional workspace instructions:\n${settings.custom_instructions.trim()}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return `${BASE_INSTRUCTIONS}\n\n${workspaceContext}`;
}

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
  instructions: string,
  input: any[],
  toolChoice: "auto" | "none"
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      model: "gpt-6-luna",
      reasoning: { effort: "none" },
      instructions,
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
  settings,
  executeHandoff
}: GenerateAIReplyParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const conversationHistory = formatHistory(history);
  const instructions = buildSystemInstructions(settings);

  const prompt = conversationHistory
    ? `Recent conversation:\n${conversationHistory}\n\nLatest customer message:\n${customerMessage}`
    : `Latest customer message:\n${customerMessage}`;

  const initialInput = [
    {
      role: "user",
      content: prompt
    }
  ];

  const firstResponse = await callOpenAI(
    apiKey,
    instructions,
    initialInput,
    "auto"
  );

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

  const finalResponse = await callOpenAI(
    apiKey,
    instructions,
    followUpInput,
    "none"
  );
  const finalText = extractResponseText(finalResponse);

  if (!finalText) {
    throw new Error("OpenAI returned no usable text after tool execution");
  }

  return finalText;
}
