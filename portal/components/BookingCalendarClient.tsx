"use client";

import { useMemo, useState } from "react";
import BookingStatusSelect from "./BookingStatusSelect";

type Booking = {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  booking_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  display_name: string | null;
  phone_number: string | null;
};

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

export default function BookingCalendarClient({
  bookings,
  contacts
}:{
  bookings:Booking[];
  contacts:Contact[];
}){
  const [selectedMonth,setSelectedMonth]=useState(monthKeyFromNow());
  const contactMap=useMemo(()=>new Map(contacts.map(c=>[c.id,c])),[contacts]);

  const {
    selectedYear,
    selectedMonthNumber,
    monthBookings,
    bookingsByDay,
    cells,
    pendingCount,
    confirmedCount,
    activeCount
  }=useMemo(()=>{
    const [year,month]=selectedMonth.split("-").map(Number);
    const filtered=bookings.filter(booking=>{
      const p=hkDateParts(new Date(booking.scheduled_at));
      return p.year===year && p.month===month;
    });

    const byDay=new Map<number,Booking[]>();
    for(const booking of filtered){
      const p=hkDateParts(new Date(booking.scheduled_at));
      const list=byDay.get(p.day)??[];
      list.push(booking);
      byDay.set(p.day,list);
    }

    const firstDay=new Date(Date.UTC(year,month-1,1));
    const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
    const mondayIndex=(firstDay.getUTCDay()+6)%7;
    const monthCells:Array<{day:number|null}>=[];

    for(let i=0;i<mondayIndex;i++) monthCells.push({day:null});
    for(let day=1;day<=daysInMonth;day++) monthCells.push({day});
    while(monthCells.length%7!==0) monthCells.push({day:null});

    return {
      selectedYear:year,
      selectedMonthNumber:month,
      monthBookings:filtered,
      bookingsByDay:byDay,
      cells:monthCells,
      pendingCount:filtered.filter(b=>b.status==="pending").length,
      confirmedCount:filtered.filter(b=>b.status==="confirmed").length,
      activeCount:filtered.filter(b=>!["cancelled","completed","no_show"].includes(b.status)).length
    };
  },[bookings,selectedMonth]);

  const todayParts=hkDateParts(new Date());

  function changeMonth(next:string){
    setSelectedMonth(next);
    if(typeof window!=="undefined"){
      window.history.replaceState(null,"",`/bookings?month=${next}`);
    }
  }

  return <>
    <div className="page-header calendar-page-header">
      <div>
        <h1>預約行事曆</h1>
        <p className="muted">以月曆方式查看及管理所有 WhatsLead 預約。</p>
      </div>
      <button className="btn calendar-today-btn" type="button" onClick={()=>changeMonth(monthKeyFromNow())}>今日</button>
    </div>

    <div className="calendar-summary">
      <div className="calendar-summary-card"><span>本月預約</span><strong>{monthBookings.length}</strong></div>
      <div className="calendar-summary-card"><span>待確認</span><strong>{pendingCount}</strong></div>
      <div className="calendar-summary-card"><span>已確認</span><strong>{confirmedCount}</strong></div>
      <div className="calendar-summary-card"><span>進行中</span><strong>{activeCount}</strong></div>
    </div>

    <section className="calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button className="calendar-nav-btn" type="button" onClick={()=>changeMonth(shiftMonth(selectedMonth,-1))} aria-label="上個月">‹</button>
          <h2>{monthTitle(selectedMonth)}</h2>
          <button className="calendar-nav-btn" type="button" onClick={()=>changeMonth(shiftMonth(selectedMonth,1))} aria-label="下個月">›</button>
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
                  <div className="calendar-event-top">
                    <div className="calendar-event-time">{p.hour}:{p.minute}</div>
                    <span className={"calendar-event-status "+statusClass(booking.status)}>{statusLabel(booking.status)}</span>
                  </div>
                  <div className="calendar-event-name">{contact?.display_name||contact?.phone_number||"客戶"}</div>
                  <div className="calendar-event-meta">{typeLabel(booking.booking_type)} · {booking.duration_minutes} 分鐘</div>
                  <div className="calendar-event-reason" title={booking.notes||"未提供原因"}>
                    原因：{booking.notes||"未提供原因"}
                  </div>
                </>;

                return booking.conversation_id
                  ? <a href={"/conversations/"+booking.conversation_id} className={"calendar-event "+statusClass(booking.status)} key={booking.id} title={statusLabel(booking.status)}>{event}</a>
                  : <div className={"calendar-event "+statusClass(booking.status)} key={booking.id} title={statusLabel(booking.status)}>{event}</div>;
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
              <small><strong>原因：</strong>{booking.notes||"未提供原因"}</small>
            </div>
            <BookingStatusSelect id={booking.id} initial={booking.status}/>
            {booking.conversation_id ? <a className="text-link" href={"/conversations/"+booking.conversation_id}>查看對話 →</a> : null}
          </div>;
        }) : <div className="card muted">這個月暫時未有預約。</div>}
      </div>
    </section>
  </>;
}
