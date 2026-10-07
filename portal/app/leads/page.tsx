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
        <h1>接手管理</h1>
        <p className="muted">管理 AI 與真人之間的 WhatsApp 對話交接，查看目前等待真人、真人處理中或已交回 AI 的狀態。</p>
      </div>
      <span className="pill">{leads?.length??0} 個跟進項目</span>
    </div>

    <LeadPipelineBoard
      initialLeads={leads??[]}
      contacts={contacts??[]}
    />
  </PortalShell>;
}
