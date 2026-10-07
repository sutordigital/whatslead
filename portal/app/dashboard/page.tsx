import PortalShell from "../../components/PortalShell";
import { requireTenant } from "../../lib/tenant";

function leadLabel(value:string){
  if(value==="high_potential") return "高潛力";
  if(value==="potential") return "有潛力";
  return "初步查詢";
}

function statusLabel(value:string){
  if(value==="pending") return "待跟進";
  if(value==="contacted") return "已聯絡";
  if(value==="resolved") return "已完成";
  if(value==="cancelled") return "已取消";
  return value;
}

export default async function DashboardPage(){
  const { supabase, tenantId } = await requireTenant();

  const [{ count: conversations }, { count: pending }, { count: highPotential }] = await Promise.all([
    supabase.from("conversations").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId),
    supabase.from("handoffs").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("status","pending"),
    supabase.from("handoffs").select("*",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("lead_status","high_potential")
  ]);

  const { data: recent } = await supabase
    .from("handoffs")
    .select("id,lead_status,status,summary,created_at")
    .eq("tenant_id",tenantId)
    .order("created_at",{ascending:false})
    .limit(5);

  return <PortalShell>
    <h1>總覽</h1>
    <p className="muted">快速查看 WhatsLead 工作空間的最新狀況。</p>

    <div className="grid grid3">
      <div className="card"><div className="muted">對話數目</div><h2>{conversations ?? 0}</h2></div>
      <div className="card"><div className="muted">待跟進潛在客戶</div><h2>{pending ?? 0}</h2></div>
      <div className="card"><div className="muted">高潛力客戶</div><h2>{highPotential ?? 0}</h2></div>
    </div>

    <h2>最近潛在客戶</h2>
    <div className="list">
      {recent?.length ? recent.map(item=>
        <div className="card" key={item.id}>
          <div className="row">
            <strong>{leadLabel(item.lead_status)}</strong>
            <span className="pill">{statusLabel(item.status)}</span>
          </div>
          <p>{item.summary}</p>
          <small className="muted">{new Date(item.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
        </div>
      ) : <div className="card muted">暫時未有需要人工跟進的潛在客戶。</div>}
    </div>
  </PortalShell>;
}
