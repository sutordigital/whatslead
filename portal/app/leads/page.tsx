import PortalShell from "../../components/PortalShell";
import LeadStatusSelect from "../../components/LeadStatusSelect";
import { requireTenant } from "../../lib/tenant";

export default async function LeadsPage(){
  const { supabase, tenantId } = await requireTenant();
  const { data: leads } = await supabase.from("handoffs").select("id,contact_id,conversation_id,reason,lead_status,summary,status,created_at,updated_at").eq("tenant_id",tenantId).order("updated_at",{ascending:false}).limit(100);
  const contactIds=[...new Set((leads??[]).map(l=>l.contact_id))];
  const { data: contacts }=contactIds.length?await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds):{data:[] as any[]};
  const contactMap=new Map((contacts??[]).map(c=>[c.id,c]));
  return <PortalShell><h1>Leads / Handoffs</h1><p className="muted">AI-qualified leads that need human follow-up.</p><div className="list">{leads?.length?leads.map(lead=>{const contact=contactMap.get(lead.contact_id);return <div className="card" key={lead.id}><div className="row"><div><strong>{contact?.display_name||contact?.phone_number||"Lead"}</strong><div className="muted">{contact?.phone_number}</div></div><span className="pill">{lead.lead_status}</span></div><p>{lead.summary}</p><p className="muted"><strong>Reason:</strong> {lead.reason}</p><div className="row"><LeadStatusSelect id={lead.id} initial={lead.status}/><a href={"/conversations/"+lead.conversation_id}>Open conversation →</a></div></div>}) : <div className="card muted">No leads yet.</div>}</div></PortalShell>;
}
