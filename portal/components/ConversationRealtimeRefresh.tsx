"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function ConversationRealtimeRefresh({
  tenantId,
  conversationId
}: {
  tenantId: string;
  conversationId?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function refreshSoon() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    }

    const channel = supabase
      .channel(`whatslead-inbox-${tenantId}-${conversationId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`
        },
        refreshSoon
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: conversationId
            ? `conversation_id=eq.${conversationId}`
            : `tenant_id=eq.${tenantId}`
        },
        refreshSoon
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: conversationId
            ? `conversation_id=eq.${conversationId}`
            : `tenant_id=eq.${tenantId}`
        },
        refreshSoon
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [tenantId, conversationId, router]);

  return null;
}
