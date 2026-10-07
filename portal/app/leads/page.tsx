import PortalShell from "../../components/PortalShell";
import LeadPipelineBoard from "../../components/LeadPipelineBoard";
import { requireTenant } from "../../lib/tenant";

export default async function LeadsPage(){
  const { supabase, tenantId } = await requireTenant();

  const { data: leads } = await supabase
    .from("handoffs")
    .select("id,contact_id,conversation_id,reason,lead_status,summary,status,created_at,updated_at")
    .eq("tenant_id",tenantId)
    .order("updated_at",{ascending:false})
    .limit(200);

  const contactIds=[...new Set((leads??[]).map(l=>l.contact_id))];
  const { data: contacts }=contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : {data:[] as any[]};

  return <PortalShell>
    <div className="page-header lead-pipeline-page-head">
      <div>
        <h1>潛在客戶 Pipeline</h1>
        <p className="muted">將 AI 識別出的潛在客戶按人工跟進進度管理。可直接拖動卡片到另一階段。</p>
      </div>
      <span className="pill">{leads?.length??0} 個潛在客戶</span>
    </div>

    <LeadPipelineBoard
      tenantId={tenantId}
      initialLeads={leads??[]}
      contacts={contacts??[]}
    />
  </PortalShell>;
}
