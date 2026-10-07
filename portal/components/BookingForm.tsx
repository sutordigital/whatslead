"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { useTenantEntitlement } from "./TenantEntitlementProvider";

function hongKongToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default function BookingForm({
  tenantId,
  conversationId,
  contactId
}: {
  tenantId: string;
  conversationId: string;
  contactId: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(hongKongToday());
  const [time, setTime] = useState("10:00");
  const [bookingType, setBookingType] = useState("consultation");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const entitlement = useTenantEntitlement();
  const locked = !entitlement.loading && !entitlement.canUseAutomation;

  const dateTimePreview = useMemo(() => {
    if (!date || !time) return "";
    return `${date} ${time}（香港時間）`;
  }, [date, time]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    setSaving(true);
    setError("");
    setSaved(false);

    const scheduledAt = `${date}T${time}:00+08:00`;

    const { error } = await createClient()
      .from("bookings")
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        contact_id: contactId,
        booking_type: bookingType.trim() || "consultation",
        scheduled_at: scheduledAt,
        duration_minutes: Number(duration) || 30,
        timezone: "Asia/Hong_Kong",
        status: "pending",
        notes: notes.trim() || null,
        source: "crm"
      });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    setNotes("");
    router.refresh();
  }

  return (
    <form className="card grid booking-form" onSubmit={submit}>
      <div>
        <strong>建立預約</strong>
        <div className="muted">為呢個客戶新增 consultation / meeting，時間以香港時間記錄。</div>
      </div>

      <div className="form-grid-2">
        <label>
          預約日期
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </label>

        <label>
          預約時間
          <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </label>

        <label>
          預約類型
          <select className="input" value={bookingType} onChange={e => setBookingType(e.target.value)}>
            <option value="consultation">諮詢 Consultation</option>
            <option value="follow_up">跟進 Follow-up</option>
            <option value="call">電話 / WhatsApp Call</option>
            <option value="meeting">會面 Meeting</option>
          </select>
        </label>

        <label>
          時長
          <select className="input" value={duration} onChange={e => setDuration(e.target.value)}>
            <option value="15">15 分鐘</option>
            <option value="30">30 分鐘</option>
            <option value="45">45 分鐘</option>
            <option value="60">60 分鐘</option>
          </select>
        </label>
      </div>

      <label>
        備註
        <textarea
          className="input"
          rows={3}
          placeholder="例如：想了解 Google Ads 報價、下午 WhatsApp call"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </label>

      <div className="row">
        <small className="muted">{dateTimePreview}</small>
        <button className="btn" type="submit" disabled={locked || saving}>
          {saving ? "建立中..." : "建立預約"}
        </button>
      </div>

      {locked ? <div className="trial-lock-note">免費試用已結束。升級後可建立新預約。</div> : null}
      {saved ? <div className="success-note">預約已建立。</div> : null}
      {error ? <div className="error-note">建立失敗：{error}</div> : null}
    </form>
  );
}
