import PortalShell from "../../components/PortalShell";
import BookingStatusSelect from "../../components/BookingStatusSelect";
import { requireTenant } from "../../lib/tenant";

function typeLabel(value:string){
  if(value==="consultation") return "諮詢";
  if(value==="follow_up") return "跟進";
  if(value==="call") return "電話 / WhatsApp Call";
  if(value==="meeting") return "會面";
  return value;
}

function statusLabel(value:string){
  if(value==="pending") return "待確認";
  if(value==="confirmed") return "已確認";
  if(value==="completed") return "已完成";
  if(value==="cancelled") return "已取消";
  if(value==="no_show") return "未有出席";
  return value;
}

export default async function BookingsPage(){
  const { supabase, tenantId } = await requireTenant();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,contact_id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes,created_at")
    .eq("tenant_id",tenantId)
    .order("scheduled_at",{ascending:true})
    .limit(100);

  const contactIds=[...new Set((bookings??[]).map(b=>b.contact_id))];
  const { data: contacts }=contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : {data:[] as any[]};

  const contactMap=new Map((contacts??[]).map(c=>[c.id,c]));
  const now=Date.now();
  const upcoming=(bookings??[]).filter(b=>new Date(b.scheduled_at).getTime()>=now && !["cancelled","completed"].includes(b.status));
  const history=(bookings??[]).filter(b=>!upcoming.some(u=>u.id===b.id));

  const bookingCard=(booking:any)=>{
    const contact=contactMap.get(booking.contact_id);
    return <div className="card booking-card" key={booking.id}>
      <div className="row booking-card-top">
        <div>
          <div className="booking-title">{contact?.display_name||contact?.phone_number||"客戶"}</div>
          <div className="muted">{contact?.phone_number}</div>
        </div>
        <span className="pill">{statusLabel(booking.status)}</span>
      </div>

      <div className="booking-meta">
        <strong>{new Date(booking.scheduled_at).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong",dateStyle:"medium",timeStyle:"short"})}</strong>
        <span>{typeLabel(booking.booking_type)} · {booking.duration_minutes} 分鐘</span>
      </div>

      {booking.notes ? <p>{booking.notes}</p> : null}

      <div className="row">
        <BookingStatusSelect id={booking.id} initial={booking.status}/>
        {booking.conversation_id ? <a className="text-link" href={"/conversations/"+booking.conversation_id}>查看對話 →</a> : null}
      </div>
    </div>;
  };

  return <PortalShell>
    <div className="page-header">
      <div>
        <h1>預約</h1>
        <p className="muted">查看及管理由 WhatsLead 建立的 consultation、電話及會面。</p>
      </div>
      <div className="pill">{upcoming.length} 個即將進行</div>
    </div>

    <h2>即將進行</h2>
    <div className="list">
      {upcoming.length ? upcoming.map(bookingCard) : <div className="card muted">暫時未有即將進行的預約。</div>}
    </div>

    <h2>其他預約</h2>
    <div className="list">
      {history.length ? history.map(bookingCard) : <div className="card muted">暫時未有其他預約紀錄。</div>}
    </div>
  </PortalShell>;
}
