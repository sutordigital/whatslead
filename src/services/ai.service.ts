import type { TenantAISettings } from "./tenantAISettings.service.js";

type ConversationHistoryItem = {
  sender_type: string;
  direction: string;
  content: string;
  created_at: string;
};

export type ActiveBookingContext = {
  id: string;
  status: string;
  bookingType: "consultation" | "follow_up" | "call" | "meeting";
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  notes: string | null;
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

export type BookingToolArgs = {
  date: string;
  time: string;
  booking_type: "consultation" | "follow_up" | "call" | "meeting";
  duration_minutes: number;
  notes: string;
};

export type BookingToolResult = {
  success: boolean;
  bookingId?: string;
  status?: string;
  scheduledAt?: string;
  created?: boolean;
  error?: string;
};

export type AvailabilityToolArgs = {
  date: string;
  duration_minutes: number;
};

export type AvailabilityToolResult = {
  success: boolean;
  date?: string;
  timezone?: string;
  durationMinutes?: number;
  available?: boolean;
  slots?: string[];
  reason?: string;
  error?: string;
};

type GenerateAIReplyParams = {
  history: ConversationHistoryItem[];
  customerMessage: string;
  settings: TenantAISettings | null;
  activeBooking?: ActiveBookingContext | null;
  executeHandoff: (args: HandoffToolArgs) => Promise<HandoffToolResult>;
  executeBooking: (args: BookingToolArgs) => Promise<BookingToolResult>;
  executeAvailability: (args: AvailabilityToolArgs) => Promise<AvailabilityToolResult>;
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

Booking:
- If the prospect asks what times are available on a specific date, use check_booking_availability before suggesting times.
- Only suggest time slots returned by check_booking_availability.
- Use the create_booking tool only when the prospect has clearly agreed to a specific future date and time for a consultation, call, or meeting.
- If the date is missing or ambiguous, ask for the date first.
- Never invent availability or claim a slot is free without a successful backend check or successful booking creation.
- Bookings created by this tool are pending confirmation, not confirmed appointments.
- If the customer asks for "tomorrow", "next Monday", or another relative date, resolve it using the current Hong Kong date supplied below.
- Historical relative-date wording such as "today", "tomorrow", "next Monday", or "later" is not a source of truth after time has passed.
- When an ACTIVE BOOKING record is supplied below, always treat its exact scheduled datetime and status as the source of truth for any booking-related reply.
- Recalculate words such as "today" or "tomorrow" from the exact scheduled datetime using the current Hong Kong date/time. Never repeat stale relative-date wording from conversation history.
- Only tell the prospect the booking request was created if the tool result says success=true.
- If create_booking fails because the requested time is unavailable or outside configured hours, explain briefly and ask for another time or offer to check a specific date.
- When successful, make clear that the booking is pending confirmation unless a human has explicitly confirmed it.

Human escalation:
Use the handoff_to_human tool when:
- The prospect asks for a quotation or exact pricing
- The prospect says they want to start or proceed
- The prospect wants to speak with a person
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

const AVAILABILITY_TOOL = {
  type: "function",
  name: "check_booking_availability",
  description:
    "Check real booking availability for a specific date and return valid open time slots.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Date to check in YYYY-MM-DD format, interpreted in Asia/Hong_Kong."
      },
      duration_minutes: {
        type: "integer",
        minimum: 15,
        maximum: 480,
        description: "Required appointment duration in minutes. Use 30 when not specified."
      }
    },
    required: ["date", "duration_minutes"],
    additionalProperties: false
  },
  strict: true
};

const BOOKING_TOOL = {
  type: "function",
  name: "create_booking",
  description:
    "Create a pending booking request after the prospect has explicitly agreed to a specific future date and time.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Booking date in YYYY-MM-DD format, interpreted in Asia/Hong_Kong."
      },
      time: {
        type: "string",
        description: "Booking time in 24-hour HH:MM format, interpreted in Asia/Hong_Kong."
      },
      booking_type: {
        type: "string",
        enum: ["consultation", "follow_up", "call", "meeting"],
        description: "The type of appointment being requested."
      },
      duration_minutes: {
        type: "integer",
        minimum: 15,
        maximum: 480,
        description: "Expected duration in minutes. Use 30 when no duration is specified."
      },
      notes: {
        type: "string",
        description: "Short factual note about the purpose of the booking."
      }
    },
    required: ["date", "time", "booking_type", "duration_minutes", "notes"],
    additionalProperties: false
  },
  strict: true
};

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

  const hongKongNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date());

  return `${BASE_INSTRUCTIONS}\n\nCurrent Hong Kong date/time: ${hongKongNow}\nTimezone: Asia/Hong_Kong\n\n${workspaceContext}`;
}

function formatHistory(history: ConversationHistoryItem[]) {
  return history
    .map((message) => {
      const role =
        message.direction === "inbound" || message.sender_type === "customer"
          ? "Customer"
          : "WhatsLead";

      const timestamp = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).format(new Date(message.created_at));

      return `[${timestamp} HKT] ${role}: ${message.content}`;
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
      tools: [HANDOFF_TOOL, BOOKING_TOOL, AVAILABILITY_TOOL],
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
  activeBooking,
  executeHandoff,
  executeBooking,
  executeAvailability
}: GenerateAIReplyParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const conversationHistory = formatHistory(history);
  const instructions = buildSystemInstructions(settings);

  const bookingContext = activeBooking
    ? [
        "ACTIVE BOOKING — SOURCE OF TRUTH",
        `Booking ID: ${activeBooking.id}`,
        `Status: ${activeBooking.status}`,
        `Type: ${activeBooking.bookingType}`,
        `Scheduled at (UTC): ${activeBooking.scheduledAt}`,
        `Timezone: ${activeBooking.timezone}`,
        `Duration minutes: ${activeBooking.durationMinutes}`,
        activeBooking.notes ? `Notes: ${activeBooking.notes}` : ""
      ].filter(Boolean).join("\n")
    : "ACTIVE BOOKING — NONE";

  const prompt = conversationHistory
    ? `${bookingContext}\n\nRecent conversation with message timestamps:\n${conversationHistory}\n\nLatest customer message:\n${customerMessage}`
    : `${bookingContext}\n\nLatest customer message:\n${customerMessage}`;

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
      item?.type === "function_call" &&
      (
        item?.name === "handoff_to_human" ||
        item?.name === "create_booking" ||
        item?.name === "check_booking_availability"
      )
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
    let result: HandoffToolResult | BookingToolResult | AvailabilityToolResult;

    try {
      if (call.name === "create_booking") {
        const args = JSON.parse(call.arguments ?? "{}") as BookingToolArgs;
        result = await executeBooking(args);
      } else if (call.name === "check_booking_availability") {
        const args = JSON.parse(call.arguments ?? "{}") as AvailabilityToolArgs;
        result = await executeAvailability(args);
      } else {
        const args = JSON.parse(call.arguments ?? "{}") as HandoffToolArgs;
        result = await executeHandoff(args);
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed"
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
