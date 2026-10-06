import PortalShell from "../../components/PortalShell";
import { requireTenant } from "../../lib/tenant";

export default async function ConversationsPage(){
  const { supabase, tenantId } = await requireTenant();
  const { data: conversations } = await supabase.from("conversations").select("id,status,ai_mode,last_message_at,contact_id").eq("tenant_id",tenantId).order("last_message_at",{ascending:false}).limit(50);
  const contactIds = [...new Set((conversations ?? []).map(c=>c.contact_id))];
  const { data: contacts } = contactIds.length ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds) : { data: [] as any[] };
  const contactMap = new Map((contacts ?? []).map(c=>[c.id,c]));
  return <PortalShell><h1>Conversations</h1><p className="muted">Recent WhatsApp conversations.</p><div className="list">{conversations?.length ? conversations.map(c=>{const contact=contactMap.get(c.contact_id);return <a className="card" key={c.id} href={"/conversations/"+c.id}><div className="row"><div><strong>{contact?.display_name || contact?.phone_number || "Unknown contact"}</strong><div className="muted">{contact?.phone_number}</div></div><span className="pill">{c.status}</span></div><small className="muted">Last message: {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "—"}</small></a>}) : <div className="card muted">No conversations yet.</div>}</div></PortalShell>;
}
