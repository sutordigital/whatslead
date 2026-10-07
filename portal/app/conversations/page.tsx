import PortalShell from "../../components/PortalShell";
import ConversationRealtimeRefresh from "../../components/ConversationRealtimeRefresh";
import { requireTenant } from "../../lib/tenant";

function statusLabel(value:string){
  if(value==="open") return "進行中";
  if(value==="closed") return "已結束";
  return value;
}

function initials(name?:string|null, phone?:string|null){
  const source=(name||phone||"?").trim();
  return source.slice(0,1).toUpperCase();
}

export default async function ConversationsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>
}){
  const { q = "" } = await searchParams;
  const { supabase, tenantId } = await requireTenant();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,status,ai_mode,last_message_at,contact_id")
    .eq("tenant_id",tenantId)
    .order("last_message_at",{ascending:false})
    .limit(50);

  const conversationIds=(conversations??[]).map(c=>c.id);
  const contactIds=[...new Set((conversations??[]).map(c=>c.contact_id))];

  const [{ data: contacts }, { data: recentMessages }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
      : Promise.resolve({data:[] as any[]}),
    conversationIds.length
      ? supabase.from("messages").select("conversation_id,content,created_at").in("conversation_id",conversationIds).order("created_at",{ascending:false}).limit(250)
      : Promise.resolve({data:[] as any[]})
  ]);

  const contactMap=new Map((contacts??[]).map(c=>[c.id,c]));
  const previewMap=new Map<string,any>();
  for(const message of recentMessages??[]){
    if(!previewMap.has(message.conversation_id)) previewMap.set(message.conversation_id,message);
  }

  const query=q.trim().toLowerCase();
  const visibleConversations=query
    ? (conversations??[]).filter(item=>{
        const person=contactMap.get(item.contact_id);
        return [
          person?.display_name,
          person?.phone_number,
          previewMap.get(item.id)?.content
        ].some(value=>typeof value==="string" && value.toLowerCase().includes(query));
      })
    : (conversations??[]);

  return <PortalShell>
    <ConversationRealtimeRefresh tenantId={tenantId}/>

    <div className="inbox-shell no-selection">
      <aside className="inbox-list-panel">
        <div className="inbox-panel-head">
          <div>
            <div className="inbox-kicker">收件匣</div>
            <h1>對話</h1>
          </div>
          <span className="pill">{visibleConversations.length}</span>
        </div>

        <form className="inbox-search-wrap" action="/conversations">
          <input className="input inbox-search" name="q" defaultValue={q} placeholder="搜尋客戶或電話號碼" />
        </form>

        <div className="inbox-conversation-list">
          {visibleConversations.map(item=>{
            const person=contactMap.get(item.contact_id);
            const preview=previewMap.get(item.id);
            return <a className="inbox-conversation-item" href={"/conversations/"+item.id} key={item.id}>
              <div className="inbox-avatar">{initials(person?.display_name,person?.phone_number)}</div>
              <div className="inbox-conversation-main">
                <div className="inbox-conversation-top">
                  <strong>{person?.display_name||person?.phone_number||"未知聯絡人"}</strong>
                  <small>{item.last_message_at?new Date(item.last_message_at).toLocaleTimeString("zh-HK",{hour:"2-digit",minute:"2-digit"}):""}</small>
                </div>
                <div className="inbox-preview">{preview?.content||person?.phone_number||"暫未有訊息"}</div>
                <div className="inbox-tags">
                  <span className="mini-pill">{statusLabel(item.status)}</span>
                  <span className={"mini-pill "+(item.ai_mode==="active"?"blue":"")}>{item.ai_mode==="active"?"AI 啟用":"AI 暫停"}</span>
                </div>
              </div>
            </a>;
          })}
        </div>
      </aside>

      <section className="inbox-empty-state">
        <div>
          <div className="inbox-empty-icon">💬</div>
          <h2>選擇一個對話</h2>
          <p className="muted">從左邊選擇客戶，即可查看訊息、回覆及管理預約。</p>
        </div>
      </section>
    </div>
  </PortalShell>;
}
