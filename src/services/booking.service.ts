import { db } from "../db.js";

export type BookingType = "consultation" | "follow_up" | "call" | "meeting";

export interface CreateAIBookingParams {
  tenantId: string;
  conversationId: string;
  contactId: string;
  bookingType: BookingType;
  date: string;
  time: string;
  durationMinutes: number;
  notes?: string | null;
}

export interface CreateAIBookingResult {
  id: string;
  status: string;
  scheduledAt: string;
  created: boolean;
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid booking date");
  }
}

function assertTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Invalid booking time");
  }
}

export async function createAIBooking(
  params: CreateAIBookingParams
): Promise<CreateAIBookingResult> {
  assertDate(params.date);
  assertTime(params.time);

  if (!Number.isInteger(params.durationMinutes) || params.durationMinutes < 15 || params.durationMinutes > 480) {
    throw new Error("Invalid booking duration");
  }

  const scheduledAt = new Date(`${params.date}T${params.time}:00+08:00`);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid booking date/time");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Booking time must be in the future");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const duplicate = await client.query(
      `
      select id, status, scheduled_at
      from public.bookings
      where tenant_id = $1
        and conversation_id = $2
        and scheduled_at = $3
        and status in ('pending', 'confirmed')
      limit 1
      for update
      `,
      [params.tenantId, params.conversationId, scheduledAt.toISOString()]
    );

    if (duplicate.rowCount && duplicate.rows[0]) {
      await client.query("COMMIT");

      return {
        id: duplicate.rows[0].id,
        status: duplicate.rows[0].status,
        scheduledAt: new Date(duplicate.rows[0].scheduled_at).toISOString(),
        created: false
      };
    }

    const created = await client.query(
      `
      insert into public.bookings (
        tenant_id,
        conversation_id,
        contact_id,
        booking_type,
        scheduled_at,
        duration_minutes,
        timezone,
        status,
        notes,
        source
      )
      values ($1, $2, $3, $4, $5, $6, 'Asia/Hong_Kong', 'pending', $7, 'ai')
      returning id, status, scheduled_at
      `,
      [
        params.tenantId,
        params.conversationId,
        params.contactId,
        params.bookingType,
        scheduledAt.toISOString(),
        params.durationMinutes,
        params.notes?.trim() || null
      ]
    );

    await client.query("COMMIT");

    return {
      id: created.rows[0].id,
      status: created.rows[0].status,
      scheduledAt: new Date(created.rows[0].scheduled_at).toISOString(),
      created: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
