import PortalShell from "../../components/PortalShell";
import LeadStatusSelect from "../../components/LeadStatusSelect";
import { requireTenant } from "../../lib/tenant";

function leadLabel(value:string){
  if(value==="high_potential") return "高潛力";
  if(value==="potential") return "有潛力";
  return "初步查詢";
}

export default async function LeadsPage(){
  const { supabase, tenantId } = await requireTenant();

  const { data: leads } = await supabase
    .from("handoffs")
    .select("id,contact_id,conversation_id,reason,lead_status,summary,status,created_at,updated_at")
    .eq("tenant_id",tenantId)
    .order("updated_at",{ascending:false})
    .limit(100);

  const contactIds=[...new Set((leads??[]).map(l=>l.contact_id))];
  const { data: contacts }=contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : {data:[] as any[]};

  const contactMap=new Map((contacts??[]).map(c=>[c.id,c]));

  return <PortalShell>
    <h1>潛在客戶 / 人工跟進</h1>
    <p className="muted">AI 已識別並需要人工跟進的客戶查詢。</p>

    <div className="list">
      {leads?.length ? leads.map(lead=>{
        const contact=contactMap.get(lead.contact_id);
        return <div className="card" key={lead.id}>
          <div className="row">
            <div>
              <strong>{contact?.display_name||contact?.phone_number||"潛在客戶"}</strong>
              <div className="muted">{contact?.phone_number}</div>
            </div>
            <span className="pill">{leadLabel(lead.lead_status)}</span>
          </div>
          <p>{lead.summary}</p>
          <p className="muted"><strong>跟進原因：</strong> {lead.reason}</p>
          <div className="row">
            <LeadStatusSelect id={lead.id} initial={lead.status}/>
            <a href={"/conversations/"+lead.conversation_id}>查看對話 →</a>
          </div>
        </div>;
      }) : <div className="card muted">暫時未有需要人工跟進的潛在客戶。</div>}
    </div>
  </PortalShell>;
}
