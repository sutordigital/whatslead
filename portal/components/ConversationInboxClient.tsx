"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import ConversationAIModeToggle from "./ConversationAIModeToggle";
import HumanReplyComposer from "./HumanReplyComposer";
import BookingForm from "./BookingForm";
import BookingStatusSelect from "./BookingStatusSelect";

type Conversation = {
  id:string;
  contact_id:string;
  status:string;
  ai_mode:string;
  last_message_at:string|null;
};

type Contact = {
  id:string;
  display_name:string|null;
  phone_number:string|null;
};

type Message = {
  id:string;
  conversation_id?:string;
  direction:string;
  sender_type:string;
  content:string;
  status:string;
  created_at:string;
};

type Booking = {
  id:string;
  conversation_id?:string;
  booking_type:string;
  scheduled_at:string;
  duration_minutes:number;
  status:string;
  notes:string|null;
};

type Preview = {
  conversation_id:string;
  content:string;
  created_at:string;
};

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

function senderLabel(direction:string,senderType:string){
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

function initials(name?:string|null,phone?:string|null){
  const source=(name||phone||"?").trim();
  return source.slice(0,1).toUpperCase();
}

export default function ConversationInboxClient({
  tenantId,
  initialConversationId,
  initialConversations,
  initialContacts,
  initialPreviews,
  initialMessages,
  initialBookings
}:{
  tenantId:string;
  initialConversationId:string;
  initialConversations:Conversation[];
  initialContacts:Contact[];
  initialPreviews:Preview[];
  initialMessages:Message[];
  initialBookings:Booking[];
}){
  const supabase=useMemo(()=>createClient(),[]);
  const [conversations,setConversations]=useState(initialConversations);
  const [contacts,setContacts]=useState(initialContacts);
  const [selectedId,setSelectedId]=useState(initialConversationId);
  const [loading,setLoading]=useState(false);
  const [query,setQuery]=useState("");
  const [messageCache,setMessageCache]=useState<Record<string,Message[]>>({
    [initialConversationId]:initialMessages
  });
  const [bookingCache,setBookingCache]=useState<Record<string,Booking[]>>({
    [initialConversationId]:initialBookings
  });
  const [previewMap,setPreviewMap]=useState<Record<string,Preview>>(
    Object.fromEntries(initialPreviews.map(p=>[p.conversation_id,p]))
  );
  const requestToken=useRef(0);

  const contactMap=useMemo(
    ()=>new Map(contacts.map(c=>[c.id,c])),
    [contacts]
  );

  const selectedConversation=conversations.find(c=>c.id===selectedId) || initialConversations.find(c=>c.id===initialConversationId)!;
  const selectedContact=selectedConversation ? contactMap.get(selectedConversation.contact_id) : undefined;
  const messages=messageCache[selectedId]??[];
  const bookings=bookingCache[selectedId]??[];
  const activeBooking=bookings.find(b=>["pending","confirmed"].includes(b.status))??null;

  const visibleConversations=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return conversations;
    return conversations.filter(item=>{
      const person=contactMap.get(item.contact_id);
      const preview=previewMap[item.id];
      return [person?.display_name,person?.phone_number,preview?.content]
        .some(value=>typeof value==="string" && value.toLowerCase().includes(q));
    });
  },[conversations,contactMap,previewMap,query]);

  async function loadConversation(id:string,background=false){
    if(messageCache[id] && bookingCache[id]) return;

    const token=++requestToken.current;
    if(!background) setLoading(true);

    const [{data:nextMessages},{data:nextBookings}]=await Promise.all([
      supabase
        .from("messages")
        .select("id,conversation_id,direction,sender_type,content,status,created_at")
        .eq("conversation_id",id)
        .eq("tenant_id",tenantId)
        .order("created_at",{ascending:true})
        .limit(200),
      supabase
        .from("bookings")
        .select("id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes")
        .eq("conversation_id",id)
        .eq("tenant_id",tenantId)
        .order("scheduled_at",{ascending:true})
        .limit(20)
    ]);

    setMessageCache(prev=>({...prev,[id]:nextMessages??[]}));
    setBookingCache(prev=>({...prev,[id]:nextBookings??[]}));

    if(!background && token===requestToken.current) setLoading(false);
  }

  async function selectConversation(id:string){
    if(id===selectedId) return;
    setSelectedId(id);
    setLoading(!(messageCache[id] && bookingCache[id]));
    window.history.pushState(null,"",`/conversations/${id}`);
    await loadConversation(id);
  }

  useEffect(()=>{
    function onPopState(){
      const match=window.location.pathname.match(/\/conversations\/([^/]+)/);
      if(match?.[1] && conversations.some(c=>c.id===match[1])){
        setSelectedId(match[1]);
        loadConversation(match[1]);
      }
    }
    window.addEventListener("popstate",onPopState);
    return ()=>window.removeEventListener("popstate",onPopState);
  },[conversations]);

  useEffect(()=>{
    const channel=supabase
      .channel(`whatslead-fast-inbox-${tenantId}`)
      .on("postgres_changes",{
        event:"*",
        schema:"public",
        table:"conversations",
        filter:`tenant_id=eq.${tenantId}`
      },async payload=>{
        const row=(payload.new||{}) as any;
        if(payload.eventType==="INSERT" && row.id){
          setConversations(prev=>prev.some(c=>c.id===row.id)?prev:[row as Conversation,...prev]);
          if(row.contact_id && !contactMap.has(row.contact_id)){
            const {data}=await supabase.from("contacts").select("id,display_name,phone_number").eq("id",row.contact_id).maybeSingle();
            if(data) setContacts(prev=>prev.some(c=>c.id===data.id)?prev:[...prev,data]);
          }
        }else if(payload.eventType==="UPDATE" && row.id){
          setConversations(prev=>prev.map(c=>c.id===row.id?{...c,...row}:c));
        }else if(payload.eventType==="DELETE"){
          const old=(payload.old||{}) as any;
          setConversations(prev=>prev.filter(c=>c.id!==old.id));
        }
      })
      .on("postgres_changes",{
        event:"INSERT",
        schema:"public",
        table:"messages",
        filter:`tenant_id=eq.${tenantId}`
      },payload=>{
        const row=payload.new as any as Message & {conversation_id:string};
        setPreviewMap(prev=>({...prev,[row.conversation_id]:{
          conversation_id:row.conversation_id,
          content:row.content,
          created_at:row.created_at
        }}));
        setConversations(prev=>prev
          .map(c=>c.id===row.conversation_id?{...c,last_message_at:row.created_at}:c)
          .sort((a,b)=>new Date(b.last_message_at||0).getTime()-new Date(a.last_message_at||0).getTime())
        );
        if(row.conversation_id===selectedId){
          setMessageCache(prev=>{
            const existing=prev[row.conversation_id]??[];
            if(existing.some(m=>m.id===row.id)) return prev;
            return {...prev,[row.conversation_id]:[...existing,row]};
          });
        }
      })
      .on("postgres_changes",{
        event:"*",
        schema:"public",
        table:"bookings",
        filter:`tenant_id=eq.${tenantId}`
      },payload=>{
        const row=((payload.new||payload.old)||{}) as any;
        const conversationId=row.conversation_id;
        if(!conversationId) return;
        supabase
          .from("bookings")
          .select("id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes")
          .eq("conversation_id",conversationId)
          .eq("tenant_id",tenantId)
          .order("scheduled_at",{ascending:true})
          .limit(20)
          .then(({data})=>setBookingCache(prev=>({...prev,[conversationId]:data??[]})));
      })
      .subscribe();

    return ()=>{supabase.removeChannel(channel);};
  },[tenantId,selectedId,contactMap,supabase]);

  if(!selectedConversation) return null;

  return <div className="inbox-shell">
    <aside className="inbox-list-panel">
      <div className="inbox-panel-head">
        <div>
          <div className="inbox-kicker">收件匣</div>
          <h1>對話</h1>
        </div>
        <span className="pill">{visibleConversations.length}</span>
      </div>

      <div className="inbox-search-wrap">
        <input
          className="input inbox-search"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="搜尋客戶或電話號碼"
        />
      </div>

      <div className="inbox-conversation-list">
        {visibleConversations.map(item=>{
          const person=contactMap.get(item.contact_id);
          const preview=previewMap[item.id];
          const selected=item.id===selectedId;
          return <button
            type="button"
            className={"inbox-conversation-item inbox-conversation-button "+(selected?"selected":"")}
            key={item.id}
            onClick={()=>selectConversation(item.id)}
            onMouseEnter={()=>loadConversation(item.id,true)}
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
          </button>;
        })}
      </div>
    </aside>

    <section className="inbox-chat-panel">
      <header className="inbox-chat-head">
        <div className="inbox-person">
          <div className="inbox-avatar large">{initials(selectedContact?.display_name,selectedContact?.phone_number)}</div>
          <div>
            <strong>{selectedContact?.display_name||selectedContact?.phone_number||"對話"}</strong>
            <span>{selectedContact?.phone_number} · {conversationStatus(selectedConversation.status)}</span>
          </div>
        </div>
        <ConversationAIModeToggle conversationId={selectedConversation.id} initialMode={selectedConversation.ai_mode}/>
      </header>

      <div className="inbox-message-scroll">
        {loading ? <div className="inbox-loading">載入對話中…</div> : <div className="messages inbox-messages">
          {messages.map(m=>
            <div key={m.id} className={"message "+(m.direction==="outbound"?"outbound":"")}>
              <div className="row">
                <strong>{senderLabel(m.direction,m.sender_type)}</strong>
                <small className="muted">{new Date(m.created_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"})}</small>
              </div>
              <div>{m.content}</div>
            </div>
          )}
        </div>}
      </div>

      <div className="inbox-composer">
        <HumanReplyComposer key={selectedConversation.id} conversationId={selectedConversation.id}/>
      </div>
    </section>

    <aside className="inbox-info-panel">
      <div className="inbox-contact-card">
        <div className="inbox-avatar xl">{initials(selectedContact?.display_name,selectedContact?.phone_number)}</div>
        <h2>{selectedContact?.display_name||"客戶"}</h2>
        <div className="muted">{selectedContact?.phone_number}</div>
      </div>

      <div className="inbox-info-section">
        <h3>客戶資料</h3>
        <div className="info-row"><span>對話狀態</span><strong>{conversationStatus(selectedConversation.status)}</strong></div>
        <div className="info-row"><span>AI 回覆</span><strong>{aiMode(selectedConversation.ai_mode)}</strong></div>
        <div className="info-row"><span>最後訊息</span><strong>{selectedConversation.last_message_at?new Date(selectedConversation.last_message_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong",dateStyle:"short",timeStyle:"short"}):"—"}</strong></div>
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

        <details className="inbox-details" key={selectedConversation.id}>
          <summary>建立新預約</summary>
          <BookingForm
            tenantId={tenantId}
            conversationId={selectedConversation.id}
            contactId={selectedConversation.contact_id}
          />
        </details>
      </div>
    </aside>
  </div>;
}
