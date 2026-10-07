import PortalShell from "../../../components/PortalShell";
import ConversationAIModeToggle from "../../../components/ConversationAIModeToggle";
import HumanReplyComposer from "../../../components/HumanReplyComposer";
import BookingForm from "../../../components/BookingForm";
import BookingStatusSelect from "../../../components/BookingStatusSelect";
import ConversationRealtimeRefresh from "../../../components/ConversationRealtimeRefresh";
import { requireTenant } from "../../../lib/tenant";
import { notFound } from "next/navigation";

function conversationStatus(value:string){
  if(value==="open") return "進行中";
  if(value==="closed") return "已結束";
  return value;
}

function aiMode(value:string){
  if(value==="active") return "啟用";
  if(value==="paused") return "暫停";
  return value;
}

function senderLabel(direction:string, senderType:string){
  if(direction==="inbound") return "客戶";
  if(senderType==="human") return "真人客服";
  return "WhatsLead AI";
}

function bookingTypeLabel(value:string){
  if(value==="consultation") return "諮詢";
  if(value==="follow_up") return "跟進";
  if(value==="call") return "電話 / WhatsApp Call";
  if(value==="meeting") return "會面";
  return value;
}

function initials(name?:string|null, phone?:string|null){
  const source=(name||phone||"?").trim();
  return source.slice(0,1).toUpperCase();
}

export default async function ConversationDetail({params}:{params:Promise<{id:string}>}){
  const { id } = await params;
  const { supabase, tenantId } = await requireTenant();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,contact_id,status,ai_mode,last_message_at")
    .eq("id",id)
    .eq("tenant_id",tenantId)
    .maybeSingle();

  if(!conversation) notFound();

  const [{ data: contact }, { data: messages }, { data: bookings }, { data: conversationList }] = await Promise.all([
    supabase.from("contacts").select("id,display_name,phone_number").eq("id",conversation.contact_id).maybeSingle(),
    supabase.from("messages").select("id,direction,sender_type,content,status,created_at").eq("conversation_id",id).eq("tenant_id",tenantId).order("created_at",{ascending:true}).limit(200),
    supabase.from("bookings").select("id,booking_type,scheduled_at,duration_minutes,status,notes").eq("conversation_id",id).eq("tenant_id",tenantId).order("scheduled_at",{ascending:true}).limit(20),
    supabase.from("conversations").select("id,status,ai_mode,last_message_at,contact_id").eq("tenant_id",tenantId).order("last_message_at",{ascending:false}).limit(50)
  ]);

  const conversationIds=(conversationList??[]).map(c=>c.id);
  const contactIds=[...new Set((conversationList??[]).map(c=>c.contact_id))];

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

  const activeBooking=(bookings??[]).find(b=>["pending","confirmed"].includes(b.status)) ?? null;

  return <PortalShell>
    <ConversationRealtimeRefresh tenantId={tenantId} conversationId={conversation.id}/>

    <div className="inbox-shell">
      <aside className="inbox-list-panel">
        <div className="inbox-panel-head">
          <div>
            <div className="inbox-kicker">收件匣</div>
            <h1>對話</h1>
          </div>
          <span className="pill">{conversationList?.length??0}</span>
        </div>

        <div className="inbox-search-wrap">
          <input className="input inbox-search" placeholder="搜尋客戶或電話號碼" />
        </div>

        <div className="inbox-conversation-list">
          {(conversationList??[]).map(item=>{
            const person=contactMap.get(item.contact_id);
            const preview=previewMap.get(item.id);
            const selected=item.id===conversation.id;
            return <a
              href={"/conversations/"+item.id}
              className={"inbox-conversation-item "+(selected?"selected":"")}
              key={item.id}
            >
              <div className="inbox-avatar">{initials(person?.display_name,person?.phone_number)}</div>
              <div className="inbox-conversation-main">
                <div className="inbox-conversation-top">
                  <strong>{person?.display_name||person?.phone_number||"未知聯絡人"}</strong>
                  <small>{item.last_message_at?new Date(item.last_message_at).toLocaleTimeString("zh-HK",{hour:"2-digit",minute:"2-digit"}):""}</small>
                </div>
                <div className="inbox-preview">{preview?.content||person?.phone_number||"暫未有訊息"}</div>
                <div className="inbox-tags">
                  <span className="mini-pill">{conversationStatus(item.status)}</span>
                  <span className={"mini-pill "+(item.ai_mode==="active"?"blue":"")}>AI {aiMode(item.ai_mode)}</span>
                </div>
              </div>
            </a>;
          })}
        </div>
      </aside>

      <section className="inbox-chat-panel">
        <header className="inbox-chat-head">
          <div className="inbox-person">
            <div className="inbox-avatar large">{initials(contact?.display_name,contact?.phone_number)}</div>
            <div>
              <strong>{contact?.display_name||contact?.phone_number||"對話"}</strong>
              <span>{contact?.phone_number} · {conversationStatus(conversation.status)}</span>
            </div>
          </div>
          <ConversationAIModeToggle conversationId={conversation.id} initialMode={conversation.ai_mode}/>
        </header>

        <div className="inbox-message-scroll">
          <div className="messages inbox-messages">
            {(messages??[]).map(m=>
              <div key={m.id} className={"message "+(m.direction==="outbound"?"outbound":"")}>
                <div className="row">
                  <strong>{senderLabel(m.direction,m.sender_type)}</strong>
                  <small className="muted">{new Date(m.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
                </div>
                <div>{m.content}</div>
              </div>
            )}
          </div>
        </div>

        <div className="inbox-composer">
          <HumanReplyComposer conversationId={conversation.id}/>
        </div>
      </section>

      <aside className="inbox-info-panel">
        <div className="inbox-contact-card">
          <div className="inbox-avatar xl">{initials(contact?.display_name,contact?.phone_number)}</div>
          <h2>{contact?.display_name||"客戶"}</h2>
          <div className="muted">{contact?.phone_number}</div>
        </div>

        <div className="inbox-info-section">
          <h3>客戶資料</h3>
          <div className="info-row"><span>對話狀態</span><strong>{conversationStatus(conversation.status)}</strong></div>
          <div className="info-row"><span>AI 回覆</span><strong>{aiMode(conversation.ai_mode)}</strong></div>
          <div className="info-row"><span>最後訊息</span><strong>{conversation.last_message_at?new Date(conversation.last_message_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong",dateStyle:"short",timeStyle:"short"}):"—"}</strong></div>
        </div>

        <div className="inbox-info-section">
          <div className="row">
            <h3>預約</h3>
            <a className="text-link" href="/bookings">查看全部</a>
          </div>

          {activeBooking ? <div className="compact-booking">
            <strong>{new Date(activeBooking.scheduled_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong",dateStyle:"medium",timeStyle:"short"})}</strong>
            <span>{bookingTypeLabel(activeBooking.booking_type)} · {activeBooking.duration_minutes} 分鐘</span>
            <BookingStatusSelect id={activeBooking.id} initial={activeBooking.status}/>
          </div> : <div className="muted">暫時未有有效預約。</div>}

          <details className="inbox-details">
            <summary>建立新預約</summary>
            <BookingForm tenantId={tenantId} conversationId={conversation.id} contactId={conversation.contact_id}/>
          </details>
        </div>
      </aside>
    </div>
  </PortalShell>;
}
