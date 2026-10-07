import PortalShell from "../../components/PortalShell";
import BookingStatusSelect from "../../components/BookingStatusSelect";
import ConversationRealtimeRefresh from "../../components/ConversationRealtimeRefresh";
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

function statusClass(value:string){
  if(value==="confirmed") return "confirmed";
  if(value==="completed") return "completed";
  if(value==="cancelled") return "cancelled";
  if(value==="no_show") return "no-show";
  return "pending";
}

function hkDateParts(date:Date){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Hong_Kong",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23"
  }).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return {
    year:Number(get("year")),
    month:Number(get("month")),
    day:Number(get("day")),
    hour:get("hour"),
    minute:get("minute")
  };
}

function monthKeyFromNow(){
  const p=hkDateParts(new Date());
  return `${p.year}-${String(p.month).padStart(2,"0")}`;
}

function parseMonthKey(value?:string){
  const fallback=monthKeyFromNow();
  if(!value || !/^\d{4}-\d{2}$/.test(value)) return fallback;
  const [year,month]=value.split("-").map(Number);
  if(month<1||month>12||year<2020||year>2100) return fallback;
  return value;
}

function shiftMonth(monthKey:string,delta:number){
  const [year,month]=monthKey.split("-").map(Number);
  const d=new Date(Date.UTC(year,month-1+delta,1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}

function monthTitle(monthKey:string){
  const [year,month]=monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-HK",{year:"numeric",month:"long",timeZone:"Asia/Hong_Kong"})
    .format(new Date(Date.UTC(year,month-1,15,4)));
}

export default async function BookingsPage({
  searchParams
}:{
  searchParams:Promise<{month?:string}>
}){
  const { month }=await searchParams;
  const selectedMonth=parseMonthKey(month);
  const [selectedYear,selectedMonthNumber]=selectedMonth.split("-").map(Number);
  const { supabase, tenantId } = await requireTenant();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,contact_id,conversation_id,booking_type,scheduled_at,duration_minutes,status,notes,created_at")
    .eq("tenant_id",tenantId)
    .order("scheduled_at",{ascending:true})
    .limit(500);

  const contactIds=[...new Set((bookings??[]).map(b=>b.contact_id))];
  const { data: contacts }=contactIds.length
    ? await supabase.from("contacts").select("id,display_name,phone_number").in("id",contactIds)
    : {data:[] as any[]};

  const contactMap=new Map((contacts??[]).map(c=>[c.id,c]));

  const monthBookings=(bookings??[]).filter(booking=>{
    const p=hkDateParts(new Date(booking.scheduled_at));
    return p.year===selectedYear && p.month===selectedMonthNumber;
  });

  const bookingsByDay=new Map<number,any[]>();
  for(const booking of monthBookings){
    const p=hkDateParts(new Date(booking.scheduled_at));
    const list=bookingsByDay.get(p.day)??[];
    list.push(booking);
    bookingsByDay.set(p.day,list);
  }

  const firstDay=new Date(Date.UTC(selectedYear,selectedMonthNumber-1,1));
  const daysInMonth=new Date(Date.UTC(selectedYear,selectedMonthNumber,0)).getUTCDate();
  const mondayIndex=(firstDay.getUTCDay()+6)%7;
  const cells:Array<{day:number|null}>=[];

  for(let i=0;i<mondayIndex;i++) cells.push({day:null});
  for(let day=1;day<=daysInMonth;day++) cells.push({day});
  while(cells.length%7!==0) cells.push({day:null});

  const todayParts=hkDateParts(new Date());
  const prevMonth=shiftMonth(selectedMonth,-1);
  const nextMonth=shiftMonth(selectedMonth,1);
  const currentMonth=monthKeyFromNow();

  const activeCount=monthBookings.filter(b=>!["cancelled","completed","no_show"].includes(b.status)).length;
  const confirmedCount=monthBookings.filter(b=>b.status==="confirmed").length;
  const pendingCount=monthBookings.filter(b=>b.status==="pending").length;

  return <PortalShell>
    <ConversationRealtimeRefresh tenantId={tenantId}/>

    <div className="page-header calendar-page-header">
      <div>
        <h1>預約行事曆</h1>
        <p className="muted">以月曆方式查看及管理所有 WhatsLead 預約。</p>
      </div>
      <a className="btn calendar-today-btn" href={"/bookings?month="+currentMonth}>今日</a>
    </div>

    <div className="calendar-summary">
      <div className="calendar-summary-card">
        <span>本月預約</span>
        <strong>{monthBookings.length}</strong>
      </div>
      <div className="calendar-summary-card">
        <span>待確認</span>
        <strong>{pendingCount}</strong>
      </div>
      <div className="calendar-summary-card">
        <span>已確認</span>
        <strong>{confirmedCount}</strong>
      </div>
      <div className="calendar-summary-card">
        <span>進行中</span>
        <strong>{activeCount}</strong>
      </div>
    </div>

    <section className="calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <a className="calendar-nav-btn" href={"/bookings?month="+prevMonth} aria-label="上個月">‹</a>
          <h2>{monthTitle(selectedMonth)}</h2>
          <a className="calendar-nav-btn" href={"/bookings?month="+nextMonth} aria-label="下個月">›</a>
        </div>

        <div className="calendar-legend">
          <span><i className="calendar-dot pending"/>待確認</span>
          <span><i className="calendar-dot confirmed"/>已確認</span>
          <span><i className="calendar-dot completed"/>已完成</span>
        </div>
      </div>

      <div className="calendar-weekdays">
        {["星期一","星期二","星期三","星期四","星期五","星期六","星期日"].map(day=><div key={day}>{day}</div>)}
      </div>

      <div className="calendar-grid">
        {cells.map((cell,index)=>{
          if(!cell.day) return <div className="calendar-day empty" key={"empty-"+index}/>;

          const dayBookings=bookingsByDay.get(cell.day)??[];
          const isToday=
            todayParts.year===selectedYear &&
            todayParts.month===selectedMonthNumber &&
            todayParts.day===cell.day;

          return <div className={"calendar-day "+(isToday?"today":"")} key={cell.day}>
            <div className="calendar-day-number">
              <span>{cell.day}</span>
              {dayBookings.length ? <small>{dayBookings.length} 個</small> : null}
            </div>

            <div className="calendar-events">
              {dayBookings.map(booking=>{
                const contact=contactMap.get(booking.contact_id);
                const p=hkDateParts(new Date(booking.scheduled_at));
                const event=<>
                  <div className="calendar-event-time">{p.hour}:{p.minute}</div>
                  <div className="calendar-event-name">{contact?.display_name||contact?.phone_number||"客戶"}</div>
                  <div className="calendar-event-meta">{typeLabel(booking.booking_type)} · {booking.duration_minutes} 分鐘</div>
                </>;

                return booking.conversation_id
                  ? <a
                      href={"/conversations/"+booking.conversation_id}
                      className={"calendar-event "+statusClass(booking.status)}
                      key={booking.id}
                      title={statusLabel(booking.status)}
                    >{event}</a>
                  : <div
                      className={"calendar-event "+statusClass(booking.status)}
                      key={booking.id}
                      title={statusLabel(booking.status)}
                    >{event}</div>;
              })}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="calendar-agenda">
      <div className="row">
        <h2>{monthTitle(selectedMonth)} 預約列表</h2>
        <span className="pill">{monthBookings.length} 個預約</span>
      </div>

      <div className="calendar-agenda-list">
        {monthBookings.length ? monthBookings.map(booking=>{
          const contact=contactMap.get(booking.contact_id);
          const p=hkDateParts(new Date(booking.scheduled_at));
          return <div className="calendar-agenda-item" key={booking.id}>
            <div className="calendar-agenda-date">
              <strong>{p.day}</strong>
              <span>{selectedMonthNumber}月</span>
            </div>
            <div className="calendar-agenda-main">
              <strong>{contact?.display_name||contact?.phone_number||"客戶"}</strong>
              <span>{p.hour}:{p.minute} · {typeLabel(booking.booking_type)} · {booking.duration_minutes} 分鐘</span>
              {booking.notes ? <small>{booking.notes}</small> : null}
            </div>
            <BookingStatusSelect id={booking.id} initial={booking.status}/>
            {booking.conversation_id ? <a className="text-link" href={"/conversations/"+booking.conversation_id}>查看對話 →</a> : null}
          </div>;
        }) : <div className="card muted">這個月暫時未有預約。</div>}
      </div>
    </section>
  </PortalShell>;
}
