"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function BookingStatusSelect({
  id,
  initial
}: {
  id: string;
  initial: string;
}) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    setSaving(true);

    const { error } = await createClient()
      .from("bookings")
      .update({
        status: next,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (!error) setStatus(next);
    setSaving(false);
  }

  return (
    <select
      className="input compact-select"
      value={status}
      disabled={saving}
      onChange={e => change(e.target.value)}
    >
      <option value="pending">待確認</option>
      <option value="confirmed">已確認</option>
      <option value="completed">已完成</option>
      <option value="cancelled">已取消</option>
      <option value="no_show">未有出席</option>
    </select>
  );
}
