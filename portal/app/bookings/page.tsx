import PortalShell from "../../components/PortalShell";
import BookingCalendarClient from "../../components/BookingCalendarClient";
import ConversationRealtimeRefresh from "../../components/ConversationRealtimeRefresh";
import { requireTenant } from "../../lib/tenant";

export default async function BookingsPage(){
  const { supabase, tenantId } = await requireTenant();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,contact_id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes,created_at")
    .eq("tenant_id",tenantId)
    .order("scheduled_at",{ascending:true})
    .limit(500);

  const contactIds=[...new Set((bookings??[]).map(b=>b.contact_id))];
  const { data: contacts }=contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : {data:[] as any[]};

  return <PortalShell>
    <ConversationRealtimeRefresh tenantId={tenantId}/>
    <BookingCalendarClient
      bookings={bookings??[]}
      contacts={contacts??[]}
    />
  </PortalShell>;
}
