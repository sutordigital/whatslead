import PortalShell from "../../../components/PortalShell";
import ConversationInboxClient from "../../../components/ConversationInboxClient";
import { requireTenant } from "../../../lib/tenant";
import { notFound } from "next/navigation";

export default async function ConversationDetail({
  params
}:{
  params:Promise<{id:string}>
}){
  const { id }=await params;
  const { supabase, tenantId }=await requireTenant();

  const { data: conversation }=await supabase
    .from("conversations")
    .select("id,contact_id,status,ai_mode,last_message_at")
    .eq("id",id)
    .eq("tenant_id",tenantId)
    .maybeSingle();

  if(!conversation) notFound();

  const { data: conversationList }=await supabase
    .from("conversations")
    .select("id,status,ai_mode,last_message_at,contact_id")
    .eq("tenant_id",tenantId)
    .order("last_message_at",{ascending:false})
    .limit(50);

  const conversationIds=(conversationList??[]).map(c=>c.id);
  const contactIds=[...new Set((conversationList??[]).map(c=>c.contact_id))];

  const [
    { data: contacts },
    { data: recentMessages },
    { data: messages },
    { data: bookings }
  ]=await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
      : Promise.resolve({data:[] as any[]}),
    conversationIds.length
      ? supabase.from("messages").select("conversation_id,content,created_at").in("conversation_id",conversationIds).order("created_at",{ascending:false}).limit(250)
      : Promise.resolve({data:[] as any[]}),
    supabase
      .from("messages")
      .select("id,conversation_id,direction,sender_type,content,status,created_at")
      .eq("conversation_id",id)
      .eq("tenant_id",tenantId)
      .order("created_at",{ascending:true})
      .limit(200),
    supabase
      .from("bookings")
      .select("id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes")
      .eq("conversation_id",id)
      .eq("tenant_id",tenantId)
      .order("scheduled_at",{ascending:true})
      .limit(20)
  ]);

  const previewMap=new Map<string,any>();
  for(const message of recentMessages??[]){
    if(!previewMap.has(message.conversation_id)) previewMap.set(message.conversation_id,message);
  }

  return <PortalShell>
    <ConversationInboxClient
      tenantId={tenantId}
      initialConversationId={id}
      initialConversations={conversationList??[]}
      initialContacts={contacts??[]}
      initialPreviews={[...previewMap.values()]}
      initialMessages={messages??[]}
      initialBookings={bookings??[]}
    />
  </PortalShell>;
}
