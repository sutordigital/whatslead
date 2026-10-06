import PortalShell from "../../components/PortalShell";
import { requireTenant } from "../../lib/tenant";

export default async function DashboardPage(){
  const { supabase, tenantId } = await requireTenant();
  const [{ count: conversations }, { count: pending }, { count: highPotential }] = await Promise.all([
    supabase.from("conversations").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId),
    supabase.from("handoffs").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("status","pending"),
    supabase.from("handoffs").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("lead_status","high_potential")
  ]);
  const { data: recent } = await supabase.from("handoffs").select("id,lead_status,status,summary,created_at").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(5);
  return <PortalShell><h1>Dashboard</h1><p className="muted">Your WhatsLead workspace at a glance.</p><div className="grid grid3">
    <div className="card"><div className="muted">Conversations</div><h2>{conversations ?? 0}</h2></div>
    <div className="card"><div className="muted">Pending leads</div><h2>{pending ?? 0}</h2></div>
    <div className="card"><div className="muted">High potential</div><h2>{highPotential ?? 0}</h2></div>
  </div><h2>Recent leads</h2><div className="list">{recent?.length ? recent.map(item=><div className="card" key={item.id}><div className="row"><strong>{item.lead_status}</strong><span className="pill">{item.status}</span></div><p>{item.summary}</p><small className="muted">{new Date(item.created_at).toLocaleString()}</small></div>) : <div className="card muted">No handoffs yet.</div>}</div></PortalShell>;
}
