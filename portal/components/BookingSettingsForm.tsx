"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../lib/supabase/client";

type BookingSettings = {
  timezone?: string | null;
  default_duration_minutes?: number | null;
  min_notice_minutes?: number | null;
  buffer_minutes?: number | null;
  monday_enabled?: boolean | null;
  tuesday_enabled?: boolean | null;
  wednesday_enabled?: boolean | null;
  thursday_enabled?: boolean | null;
  friday_enabled?: boolean | null;
  saturday_enabled?: boolean | null;
  sunday_enabled?: boolean | null;
  day_start?: string | null;
  day_end?: string | null;
};

const days = [
  ["monday_enabled", "星期一"],
  ["tuesday_enabled", "星期二"],
  ["wednesday_enabled", "星期三"],
  ["thursday_enabled", "星期四"],
  ["friday_enabled", "星期五"],
  ["saturday_enabled", "星期六"],
  ["sunday_enabled", "星期日"]
] as const;

export default function BookingSettingsForm({
  tenantId,
  initial
}: {
  tenantId: string;
  initial: BookingSettings | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    timezone: initial?.timezone ?? "Asia/Hong_Kong",
    default_duration_minutes: initial?.default_duration_minutes ?? 30,
    min_notice_minutes: initial?.min_notice_minutes ?? 120,
    buffer_minutes: initial?.buffer_minutes ?? 0,
    monday_enabled: initial?.monday_enabled ?? true,
    tuesday_enabled: initial?.tuesday_enabled ?? true,
    wednesday_enabled: initial?.wednesday_enabled ?? true,
    thursday_enabled: initial?.thursday_enabled ?? true,
    friday_enabled: initial?.friday_enabled ?? true,
    saturday_enabled: initial?.saturday_enabled ?? false,
    sunday_enabled: initial?.sunday_enabled ?? false,
    day_start: (initial?.day_start ?? "10:00").slice(0,5),
    day_end: (initial?.day_end ?? "18:00").slice(0,5)
  });

  const set = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const { error } = await createClient()
      .from("tenant_booking_settings")
      .upsert(
        {
          tenant_id: tenantId,
          ...form,
          updated_at: new Date().toISOString()
        },
        { onConflict: "tenant_id" }
      );

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
  }

  return (
    <form className="card grid" onSubmit={submit}>
      <div>
        <strong>預約可用時間</strong>
        <div className="muted">
          AI 只會接受符合以下規則，而且沒有撞期的預約。
        </div>
      </div>

      <div className="availability-days">
        {days.map(([key, label]) => (
          <label className="day-toggle" key={key}>
            <input
              type="checkbox"
              checked={form[key]}
              onChange={e => set(key, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="form-grid-2">
        <label>
          每日開始時間
          <input
            className="input"
            type="time"
            value={form.day_start}
            onChange={e => set("day_start", e.target.value)}
            required
          />
        </label>

        <label>
          每日結束時間
          <input
            className="input"
            type="time"
            value={form.day_end}
            onChange={e => set("day_end", e.target.value)}
            required
          />
        </label>

        <label>
          預設預約時長
          <select
            className="input"
            value={form.default_duration_minutes}
            onChange={e => set("default_duration_minutes", Number(e.target.value))}
          >
            <option value={15}>15 分鐘</option>
            <option value={30}>30 分鐘</option>
            <option value={45}>45 分鐘</option>
            <option value={60}>60 分鐘</option>
          </select>
        </label>

        <label>
          最少提前時間
          <select
            className="input"
            value={form.min_notice_minutes}
            onChange={e => set("min_notice_minutes", Number(e.target.value))}
          >
            <option value={0}>無限制</option>
            <option value={60}>1 小時</option>
            <option value={120}>2 小時</option>
            <option value={240}>4 小時</option>
            <option value={720}>12 小時</option>
            <option value={1440}>24 小時</option>
          </select>
        </label>

        <label>
          預約之間 Buffer
          <select
            className="input"
            value={form.buffer_minutes}
            onChange={e => set("buffer_minutes", Number(e.target.value))}
          >
            <option value={0}>無</option>
            <option value={10}>10 分鐘</option>
            <option value={15}>15 分鐘</option>
            <option value={30}>30 分鐘</option>
          </select>
        </label>

        <label>
          時區
          <input className="input" value={form.timezone} disabled />
        </label>
      </div>

      <button className="btn" disabled={saving}>
        {saving ? "儲存中..." : "儲存預約設定"}
      </button>

      {saved ? <div className="success-note">預約設定已儲存。</div> : null}
      {error ? <div className="error-note">儲存失敗：{error}</div> : null}
    </form>
  );
}
