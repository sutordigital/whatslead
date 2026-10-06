import PortalShell from "../../../components/PortalShell";
import ConversationAIModeToggle from "../../../components/ConversationAIModeToggle";
import HumanReplyComposer from "../../../components/HumanReplyComposer";
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

  const [{ data: contact }, { data: messages }] = await Promise.all([
    supabase.from("contacts").select("display_name,phone_number").eq("id",conversation.contact_id).maybeSingle(),
    supabase.from("messages").select("id,direction,sender_type,content,status,created_at").eq("conversation_id",id).eq("tenant_id",tenantId).order("created_at",{ascending:true}).limit(200)
  ]);

  return <PortalShell>
    <a href="/conversations" className="muted">← 返回對話紀錄</a>
    <h1>{contact?.display_name || contact?.phone_number || "對話"}</h1>
    <p className="muted">
      {contact?.phone_number} · {conversationStatus(conversation.status)} · AI {aiMode(conversation.ai_mode)}
    </p>

    <ConversationAIModeToggle
      conversationId={conversation.id}
      initialMode={conversation.ai_mode}
    />

    <div style={{height:16}} />

    <HumanReplyComposer conversationId={conversation.id} />

    <div style={{height:16}} />

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
