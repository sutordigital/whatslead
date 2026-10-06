import PortalShell from "../../../components/PortalShell";
import ConversationAIModeToggle from "../../../components/ConversationAIModeToggle";
import HumanReplyComposer from "../../../components/HumanReplyComposer";
import BookingForm from "../../../components/BookingForm";
import BookingStatusSelect from "../../../components/BookingStatusSelect";
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

export default async function ConversationDetail({params}:{params:Promise<{id:string}>}){
  const { id } = await params;
  const { supabase, tenantId } = await requireTenant();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,contact_id,status,ai_mode")
    .eq("id",id)
    .eq("tenant_id",tenantId)
    .maybeSingle();

  if(!conversation) notFound();

  const [{ data: contact }, { data: messages }, { data: bookings }] = await Promise.all([
    supabase.from("contacts").select("display_name,phone_number").eq("id",conversation.contact_id).maybeSingle(),
    supabase.from("messages").select("id,direction,sender_type,content,status,created_at").eq("conversation_id",id).eq("tenant_id",tenantId).order("created_at",{ascending:true}).limit(200),
    supabase.from("bookings").select("id,booking_type,scheduled_at,duration_minutes,status,notes").eq("conversation_id",id).eq("tenant_id",tenantId).order("scheduled_at",{ascending:true}).limit(20)
  ]);

  return <PortalShell>
    <a href="/conversations" className="muted">← 返回對話紀錄</a>
    <div className="page-header conversation-header">
      <div>
        <h1>{contact?.display_name || contact?.phone_number || "對話"}</h1>
        <p className="muted">
          {contact?.phone_number} · {conversationStatus(conversation.status)} · AI {aiMode(conversation.ai_mode)}
        </p>
      </div>
      <a className="text-link" href="/bookings">查看所有預約 →</a>
    </div>

    <div className="conversation-tools">
      <ConversationAIModeToggle
        conversationId={conversation.id}
        initialMode={conversation.ai_mode}
      />

      <BookingForm
        tenantId={tenantId}
        conversationId={conversation.id}
        contactId={conversation.contact_id}
      />
    </div>

    {bookings?.length ? <>
      <h2>此客戶的預約</h2>
      <div className="list">
        {bookings.map(booking=>
          <div className="card booking-card" key={booking.id}>
            <div className="row">
              <div>
                <strong>{new Date(booking.scheduled_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong",dateStyle:"medium",timeStyle:"short"})}</strong>
                <div className="muted">{bookingTypeLabel(booking.booking_type)} · {booking.duration_minutes} 分鐘</div>
              </div>
              <BookingStatusSelect id={booking.id} initial={booking.status}/>
            </div>
            {booking.notes ? <p>{booking.notes}</p> : null}
          </div>
        )}
      </div>
    </> : null}

    <h2>真人回覆</h2>
    <HumanReplyComposer conversationId={conversation.id} />

    <h2>對話內容</h2>
    <div className="messages">
      {messages?.map(m=>
        <div key={m.id} className={"message "+(m.direction==="outbound"?"outbound":"")}>
          <div className="row">
            <strong>{senderLabel(m.direction,m.sender_type)}</strong>
            <small className="muted">{new Date(m.created_at).toLocaleString("zh-HK")}</small>
          </div>
          <div>{m.content}</div>
        </div>
      )}
    </div>
  </PortalShell>;
}
