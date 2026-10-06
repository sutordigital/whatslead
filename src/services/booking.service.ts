import { db } from "../db.js";

export type BookingType = "consultation" | "follow_up" | "call" | "meeting";

type BookingSettings = {
  timezone: string;
  default_duration_minutes: number;
  min_notice_minutes: number;
  buffer_minutes: number;
  monday_enabled: boolean;
  tuesday_enabled: boolean;
  wednesday_enabled: boolean;
  thursday_enabled: boolean;
  friday_enabled: boolean;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
  day_start: string;
  day_end: string;
};

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

export interface FindAvailableSlotsParams {
  tenantId: string;
  date: string;
  durationMinutes?: number;
  limit?: number;
}

export interface AvailableSlotsResult {
  date: string;
  timezone: string;
  durationMinutes: number;
  available: boolean;
  slots: string[];
  reason?: string;
}

const DEFAULT_SETTINGS: BookingSettings = {
  timezone: "Asia/Hong_Kong",
  default_duration_minutes: 30,
  min_notice_minutes: 120,
  buffer_minutes: 0,
  monday_enabled: true,
  tuesday_enabled: true,
  wednesday_enabled: true,
  thursday_enabled: true,
  friday_enabled: true,
  saturday_enabled: false,
  sunday_enabled: false,
  day_start: "10:00",
  day_end: "18:00"
};

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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function weekdayKey(date: string): keyof Pick<
  BookingSettings,
  | "monday_enabled"
  | "tuesday_enabled"
  | "wednesday_enabled"
  | "thursday_enabled"
  | "friday_enabled"
  | "saturday_enabled"
  | "sunday_enabled"
> {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    weekday: "long"
  }).format(new Date(`${date}T12:00:00+08:00`));

  return `${weekday.toLowerCase()}_enabled` as ReturnType<typeof weekdayKey>;
}

async function getBookingSettings(
  tenantId: string,
  client = db
): Promise<BookingSettings> {
  const result = await client.query(
    `
    select
      timezone,
      default_duration_minutes,
      min_notice_minutes,
      buffer_minutes,
      monday_enabled,
      tuesday_enabled,
      wednesday_enabled,
      thursday_enabled,
      friday_enabled,
      saturday_enabled,
      sunday_enabled,
      day_start::text,
      day_end::text
    from public.tenant_booking_settings
    where tenant_id = $1
    limit 1
    `,
    [tenantId]
  );

  if (!result.rowCount || !result.rows[0]) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...result.rows[0],
    day_start: result.rows[0].day_start.slice(0, 5),
    day_end: result.rows[0].day_end.slice(0, 5)
  };
}

async function hasConflict(
  tenantId: string,
  start: Date,
  durationMinutes: number,
  bufferMinutes: number,
  client = db
) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const result = await client.query(
    `
    select id
    from public.bookings
    where tenant_id = $1
      and status in ('pending', 'confirmed')
      and $2::timestamptz < scheduled_at + ((duration_minutes + $4) * interval '1 minute')
      and $3::timestamptz + ($4 * interval '1 minute') > scheduled_at
    limit 1
    `,
    [tenantId, start.toISOString(), end.toISOString(), bufferMinutes]
  );

  return Boolean(result.rowCount);
}

function validateAgainstSettings(
  date: string,
  time: string,
  durationMinutes: number,
  settings: BookingSettings
) {
  const dayKey = weekdayKey(date);

  if (!settings[dayKey]) {
    throw new Error("Requested date is outside the configured booking days");
  }

  const startMinutes = timeToMinutes(time);
  const endMinutes = startMinutes + durationMinutes;
  const workStart = timeToMinutes(settings.day_start);
  const workEnd = timeToMinutes(settings.day_end);

  if (startMinutes < workStart || endMinutes > workEnd) {
    throw new Error(
      `Requested time is outside booking hours (${settings.day_start}-${settings.day_end} Hong Kong time)`
    );
  }

  const scheduledAt = new Date(`${date}T${time}:00+08:00`);
  const earliest = Date.now() + settings.min_notice_minutes * 60_000;

  if (scheduledAt.getTime() < earliest) {
    throw new Error(
      `Booking requires at least ${settings.min_notice_minutes} minutes advance notice`
    );
  }

  return scheduledAt;
}

export async function findAvailableSlots(
  params: FindAvailableSlotsParams
): Promise<AvailableSlotsResult> {
  assertDate(params.date);

  const settings = await getBookingSettings(params.tenantId);
  const durationMinutes =
    params.durationMinutes ?? settings.default_duration_minutes;
  const limit = Math.min(Math.max(params.limit ?? 4, 1), 8);

  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    throw new Error("Invalid booking duration");
  }

  const dayKey = weekdayKey(params.date);

  if (!settings[dayKey]) {
    return {
      date: params.date,
      timezone: settings.timezone,
      durationMinutes,
      available: false,
      slots: [],
      reason: "This day is not enabled for bookings"
    };
  }

  const start = timeToMinutes(settings.day_start);
  const end = timeToMinutes(settings.day_end);
  const slots: string[] = [];

  for (let minute = start; minute + durationMinutes <= end && slots.length < limit; minute += 30) {
    const time = minutesToTime(minute);
    const scheduledAt = new Date(`${params.date}T${time}:00+08:00`);
    const earliest = Date.now() + settings.min_notice_minutes * 60_000;

    if (scheduledAt.getTime() < earliest) continue;

    const conflict = await hasConflict(
      params.tenantId,
      scheduledAt,
      durationMinutes,
      settings.buffer_minutes
    );

    if (!conflict) slots.push(time);
  }

  return {
    date: params.date,
    timezone: settings.timezone,
    durationMinutes,
    available: slots.length > 0,
    slots,
    reason: slots.length ? undefined : "No available slots on this date"
  };
}

export async function createAIBooking(
  params: CreateAIBookingParams
): Promise<CreateAIBookingResult> {
  assertDate(params.date);
  assertTime(params.time);

  if (!Number.isInteger(params.durationMinutes) || params.durationMinutes < 15 || params.durationMinutes > 480) {
    throw new Error("Invalid booking duration");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const settings = await getBookingSettings(params.tenantId, client);
    const scheduledAt = validateAgainstSettings(
      params.date,
      params.time,
      params.durationMinutes,
      settings
    );

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error("Invalid booking date/time");
    }

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

    const conflict = await hasConflict(
      params.tenantId,
      scheduledAt,
      params.durationMinutes,
      settings.buffer_minutes,
      client
    );

    if (conflict) {
      throw new Error("Requested booking time is unavailable because it conflicts with another booking");
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
      values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, 'ai')
      returning id, status, scheduled_at
      `,
      [
        params.tenantId,
        params.conversationId,
        params.contactId,
        params.bookingType,
        scheduledAt.toISOString(),
        params.durationMinutes,
        settings.timezone,
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
