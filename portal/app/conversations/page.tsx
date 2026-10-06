import PortalShell from "../../components/PortalShell";
import { requireTenant } from "../../lib/tenant";

function statusLabel(value:string){
  if(value==="open") return "進行中";
  if(value==="closed") return "已結束";
  return value;
}

export default async function ConversationsPage(){
  const { supabase, tenantId } = await requireTenant();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,status,ai_mode,last_message_at,contact_id")
    .eq("tenant_id",tenantId)
    .order("last_message_at",{ascending:false})
    .limit(50);

  const contactIds = [...new Set((conversations ?? []).map(c=>c.contact_id))];
  const { data: contacts } = contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : { data: [] as any[] };

  const contactMap = new Map((contacts ?? []).map(c=>[c.id,c]));

  return <PortalShell>
    <h1>對話紀錄</h1>
    <p className="muted">查看最近的 WhatsApp 客戶對話。</p>

    <div className="list">
      {conversations?.length ? conversations.map(c=>{
        const contact=contactMap.get(c.contact_id);
        return <a className="card" key={c.id} href={"/conversations/"+c.id}>
          <div className="row">
            <div>
              <strong>{contact?.display_name || contact?.phone_number || "未知聯絡人"}</strong>
              <div className="muted">{contact?.phone_number}</div>
            </div>
            <span className="pill">{statusLabel(c.status)}</span>
          </div>
          <small className="muted">
            最後訊息：{c.last_message_at ? new Date(c.last_message_at).toLocaleString("zh-HK") : "—"}
          </small>
        </a>;
      }) : <div className="card muted">暫時未有對話紀錄。</div>}
    </div>
  </PortalShell>;
}
