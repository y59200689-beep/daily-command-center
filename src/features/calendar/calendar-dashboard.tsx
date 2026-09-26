"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { DomainRecord } from "@/lib/domains";
import { Icons } from "@/components/icons";
import "./calendar-dashboard.css";

type CalendarView = "day" | "week" | "month" | "agenda";
type Props = { rows: DomainRecord[]; view: CalendarView; onViewChange: (view: CalendarView) => void; monthOffset: number; changeMonth: (offset: number) => void; onEdit: (record: DomainRecord) => void; onCreate: (defaults?: Record<string, string>) => void; onReschedule: (record: DomainRecord, startsAt: string, endsAt: string) => Promise<void> };
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const at = (value: unknown) => new Date(String(value ?? ""));
const clock = (value: unknown) => at(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const clockMinutes = (minutes: number) => new Date(2000,0,1,0,minutes).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
const colors = ["blue", "purple", "green", "rose", "amber"] as const;
const tone = (record: DomainRecord) => colors[[...String(record.title ?? "")].reduce((n, char) => n + char.charCodeAt(0), 0) % colors.length];
const duration = (record: DomainRecord) => Math.max(0, (at(record.ends_at).getTime() - at(record.starts_at).getTime()) / 3600000) || 0;

const minutesOf = (date: Date) => date.getHours()*60+date.getMinutes();
const clamp = (value: number, min: number, max: number) => Math.min(max,Math.max(min,value));
const snap = (minutes: number) => Math.round(minutes/30)*30;

export function CalendarDashboard({ rows, view, onViewChange, monthOffset, changeMonth, onEdit, onCreate, onReschedule }: Props) {
  const today = new Date();
  const todayKey = dayKey(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false);
  const [selection, setSelection] = useState<{start:number; end:number} | null>(null);
  const dragStart = useRef<number | null>(null);
  const eventDrag = useRef<{record:DomainRecord; mode:"move"|"resize"; startY:number; start:number; end:number}|null>(null);
  const [eventPreview, setEventPreview] = useState<{id:string; start:number; end:number}|null>(null);
  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthPrefix = dayKey(month).slice(0, 7);
  const gridStart = new Date(month); gridStart.setDate(1 - month.getDay());
  const days = Array.from({length:42}, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate()+index); return date; });
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const weekStart = new Date(selectedDate); weekStart.setDate(selectedDate.getDate()-selectedDate.getDay());
  const weekDays = Array.from({length:7},(_,index) => { const date = new Date(weekStart); date.setDate(weekStart.getDate()+index); return date; });
  const scheduled = rows.filter(record => String(record.starts_at ?? "").slice(0,7) === monthPrefix);
  const upcoming = rows.filter(record => { const start = at(record.starts_at); return start.getTime() >= today.getTime() && start.getTime() < today.getTime()+7*86400000; }).sort((a,b) => at(a.starts_at).getTime()-at(b.starts_at).getTime());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7);
  const weekEvents = rows.filter(record => { const start = at(record.starts_at); return start >= weekStart && start < weekEnd; });
  const selectedEvents = rows.filter(record => String(record.starts_at ?? "").slice(0,10) === selectedKey).sort((a,b) => at(a.starts_at).getTime()-at(b.starts_at).getTime());
  const firstHour = Math.min(7,...selectedEvents.map(event => at(event.starts_at).getHours()));
  const lastHour = Math.max(19,...selectedEvents.map(event => Math.min(23,Math.ceil(minutesOf(at(event.ends_at))/60)-1)));
  const dailyHours = Array.from({length:lastHour-firstHour+1},(_,index) => firstHour+index);
  const monthEvents = rows.filter(record => !showOnlyUpcoming || at(record.starts_at) >= today).sort((a,b) => at(a.starts_at).getTime()-at(b.starts_at).getTime());
  const scheduledHours = weekEvents.reduce((sum, event) => sum + duration(event), 0);
  const focusHours = Math.max(0, 40-scheduledHours);
  const daysWithEvents = new Set(weekEvents.map(event => String(event.starts_at ?? "").slice(0,10))).size;
  const mode = view;
  function createForDay(key: string, start = 9*60, end = 10*60) {
    const localTime = (minutes: number) => `${key}T${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
    onCreate({ starts_at: localTime(start), ends_at: localTime(end) });
  }
  function slotAt(event: PointerEvent<HTMLDivElement>) {
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-calendar-hour]");
    if (!slot || !event.currentTarget.contains(slot)) return null;
    const hour = Number(slot.dataset.calendarHour);
    const rect = slot.getBoundingClientRect();
    return hour*60 + (event.clientY - rect.top >= rect.height/2 ? 30 : 0);
  }
  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const start = slotAt(event);
    if (start === null) return;
    event.preventDefault();
    dragStart.current = start;
    setSelection({start,end:start+30});
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const current = slotAt(event);
    if (current === null) return;
    setSelection({start:Math.min(dragStart.current,current),end:Math.max(dragStart.current,current)+30});
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const current = slotAt(event) ?? dragStart.current;
    const start = Math.min(dragStart.current,current);
    const end = Math.max(dragStart.current,current)+30;
    dragStart.current = null;
    setSelection(null);
    createForDay(selectedKey,start,end);
  }
  function proposedEventTime(drag: NonNullable<typeof eventDrag.current>, clientY: number) {
    const delta = snap((clientY-drag.startY)/58*60);
    if (drag.mode === "resize") return {start:drag.start,end:clamp(drag.end+delta,drag.start+30,(lastHour+1)*60)};
    const length = drag.end-drag.start;
    const start = clamp(drag.start+delta,firstHour*60,(lastHour+1)*60-length);
    return {start,end:start+length};
  }
  function beginEventDrag(event: PointerEvent<HTMLButtonElement>, record: DomainRecord) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const start = minutesOf(at(record.starts_at));
    const end = start + Math.max(30,Math.round(duration(record)*60));
    eventDrag.current = {record,mode:(event.target as HTMLElement).closest(".calendar-ui__resize") ? "resize" : "move",startY:event.clientY,start,end};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveEventDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!eventDrag.current) return;
    event.stopPropagation();
    const times = proposedEventTime(eventDrag.current,event.clientY);
    setEventPreview({id:eventDrag.current.record.id,...times});
  }
  function endEventDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = eventDrag.current;
    if (!drag) return;
    event.stopPropagation();
    eventDrag.current = null;
    const times = proposedEventTime(drag,event.clientY);
    setEventPreview(null);
    if (times.start === drag.start && times.end === drag.end) { onEdit(drag.record); return; }
    const local = (minutes: number) => { const date = new Date(`${selectedKey}T00:00:00`); date.setMinutes(minutes); return date.toISOString(); };
    void onReschedule(drag.record,local(times.start),local(times.end));
  }
  function chooseView(next: CalendarView) { onViewChange(next); }
  function shiftMonth(next: number) { changeMonth(next); const date = new Date(today.getFullYear(), today.getMonth()+next, 1); setSelectedKey(dayKey(date)); }
  function renderDay(date: Date) { const key = dayKey(date); const events = rows.filter(record => String(record.starts_at ?? "").slice(0,10) === key && (!showOnlyUpcoming || at(record.starts_at) >= today)); const outside = date.getMonth() !== month.getMonth(); return <div className={`calendar-ui__day ${outside ? "is-outside" : ""} ${key === todayKey ? "is-today" : ""} ${key === selectedKey ? "is-selected" : ""}`} key={key} onClick={() => { setSelectedKey(key); createForDay(key); }}><button className="calendar-ui__day-number" onClick={(event) => { event.stopPropagation(); setSelectedKey(key); createForDay(key); }} aria-label={`Create event on ${date.toDateString()}`}>{date.getDate()}</button><div className="calendar-ui__day-events">{events.slice(0,3).map(event => <button key={event.id} className={`calendar-ui__event calendar-ui__event--${tone(event)}`} onClick={(click) => { click.stopPropagation(); onEdit(event); }}><strong>{String(event.title)}</strong><span>{clock(event.starts_at)} – {clock(event.ends_at)}</span></button>)}{events.length > 3 && <span className="calendar-ui__more">+{events.length-3} more</span>}</div></div>; }

  return <div className="calendar-ui">
    <div className="calendar-ui__stats"><article><span className="calendar-ui__stat-icon calendar-ui__stat-icon--blue"><Icons.CalendarDays size={21}/></span><div><small>Total scheduled</small><strong>{scheduled.length}</strong><p>events this month</p></div><span className="calendar-ui__bars"><i/><i/><i/><i/></span></article><article><span className="calendar-ui__stat-icon calendar-ui__stat-icon--green"><Icons.Clock3 size={21}/></span><div><small>Available focus</small><strong>{Math.round(focusHours)}h</strong><p>estimated this week</p></div><svg className="calendar-ui__focus-chart" viewBox="0 0 112 54" role="img" aria-label={`Focus capacity: ${Math.round(focusHours)} of 40 hours available`}><defs><linearGradient id="focus-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#57c894" stopOpacity=".36"/><stop offset="100%" stopColor="#57c894" stopOpacity="0"/></linearGradient></defs><path d="M2 48 L2 43 L20 39 L37 42 L54 29 L70 32 L88 16 L110 7 L110 52 L2 52 Z" fill="url(#focus-fill)"/><path d="M2 43 L20 39 L37 42 L54 29 L70 32 L88 16 L110 7" fill="none" stroke="#24a877" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="110" cy="7" r="4" fill="#24a877" stroke="white" strokeWidth="2"/></svg></article><article><span className="calendar-ui__stat-icon calendar-ui__stat-icon--amber"><Icons.Clock3 size={21}/></span><div><small>Upcoming</small><strong>{upcoming.length}</strong><p>events next 7 days</p></div><span className="calendar-ui__bars calendar-ui__bars--warm"><i/><i/><i/><i/></span></article><article><span className="calendar-ui__stat-icon calendar-ui__stat-icon--purple"><Icons.Sparkles size={21}/></span><div><small>This week</small><strong>{daysWithEvents}</strong><p>days with events</p></div><span className="calendar-ui__week-dots">{Array.from({length:7},(_,index) => <i className={weekDays[index] && weekEvents.some(event => String(event.starts_at).slice(0,10) === dayKey(weekDays[index])) ? "is-active" : ""} key={index}/>)}</span></article></div>
    <div className="calendar-ui__content"><section className="calendar-ui__main"><div className="calendar-ui__toolbar"><div className="calendar-ui__period"><h2>{mode === "day" ? selectedDate.toLocaleDateString([], {month:"long",day:"numeric"}) : month.toLocaleDateString([], {month:"long"})} <span>{month.getFullYear()}</span></h2><button onClick={() => mode === "day" ? setSelectedKey(dayKey(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),selectedDate.getDate()-1))) : shiftMonth(monthOffset-1)} aria-label={mode === "day" ? "Previous day" : "Previous month"}><Icons.ChevronLeft size={17}/></button><button onClick={() => { changeMonth(0); setSelectedKey(todayKey); }}>Today</button><button onClick={() => mode === "day" ? setSelectedKey(dayKey(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),selectedDate.getDate()+1))) : shiftMonth(monthOffset+1)} aria-label={mode === "day" ? "Next day" : "Next month"}><Icons.ChevronRight size={17}/></button></div><div className="calendar-ui__views">{(["day","week","month","agenda"] as const).map(label => <button className={mode === label ? "is-active" : ""} onClick={() => chooseView(label)} key={label}>{label === "day" ? <Icons.Clock3 size={15}/> : label === "month" ? <Icons.CalendarDays size={15}/> : label === "week" ? <Icons.Clock3 size={15}/> : <Icons.ListTodo size={15}/>} {label}</button>)}<button className={showOnlyUpcoming ? "is-filtered" : ""} onClick={() => setShowOnlyUpcoming(value => !value)}><Icons.Search size={14}/> Filter</button></div></div>
      {mode === "day" ? <div className="calendar-ui__daily" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { dragStart.current = null; setSelection(null); }}><div className="calendar-ui__daily-head"><span>{selectedDate.toLocaleDateString([], {weekday:"long"})}</span><strong>{selectedDate.toLocaleDateString([], {month:"long",day:"numeric",year:"numeric"})}</strong><small>{selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}</small></div><div className="calendar-ui__daily-timeline">{dailyHours.map(hour => <div className="calendar-ui__hour" key={hour}><time>{new Date(2000,0,1,hour).toLocaleTimeString([], {hour:"numeric"})}</time><div data-calendar-hour={hour} className={selection && selection.start < (hour+1)*60 && selection.end > hour*60 ? "is-selecting" : ""}/></div>)}<div className="calendar-ui__event-layer">{selectedEvents.filter(event => !showOnlyUpcoming || at(event.starts_at) >= today).map(event => { const originalStart = minutesOf(at(event.starts_at)); const originalEnd = originalStart+Math.max(30,Math.round(duration(event)*60)); const preview = eventPreview?.id === event.id ? eventPreview : null; const start = preview?.start ?? originalStart; const end = preview?.end ?? originalEnd; return <button key={event.id} className={`calendar-ui__daily-event calendar-ui__daily-event--${tone(event)} ${preview ? "is-dragging" : ""}`} style={{top:`${(start-firstHour*60)/60*58+3}px`,height:`${Math.max(30,(end-start)/60*58-6)}px`}} onPointerDown={pointer => beginEventDrag(pointer,event)} onPointerMove={moveEventDrag} onPointerUp={endEventDrag} onPointerCancel={() => { eventDrag.current = null; setEventPreview(null); }} onKeyDown={key => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); onEdit(event); } }} aria-label={`${String(event.title)}, ${clock(event.starts_at)} to ${clock(event.ends_at)}. Drag to move; drag bottom edge to resize.`}><span>{preview ? clockMinutes(start) : clock(event.starts_at)} – {preview ? clockMinutes(end) : clock(event.ends_at)}</span><strong>{String(event.title)}</strong><small>{String(event.description ?? "")}</small><i className="calendar-ui__resize" aria-hidden="true"/></button>; })}</div></div><button className="calendar-ui__daily-add" onClick={() => createForDay(selectedKey)}><Icons.Plus size={16}/> Add event</button></div> : mode === "agenda" ? <div className="calendar-ui__agenda">{monthEvents.length ? monthEvents.map(event => <button key={event.id} onClick={() => onEdit(event)}><span className={`calendar-ui__dot calendar-ui__dot--${tone(event)}`}/><time>{at(event.starts_at).toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"})}<small>{clock(event.starts_at)} – {clock(event.ends_at)}</small></time><strong>{String(event.title)}</strong><Icons.ChevronRight size={16}/></button>) : <p>No events in this view.</p>}</div> : <><div className="calendar-ui__weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <span key={day}>{day}</span>)}</div><div className={`calendar-ui__grid ${mode === "week" ? "calendar-ui__grid--week" : ""}`}>{(mode === "week" ? weekDays : days).map(renderDay)}</div></>}</section>
      <aside className="calendar-ui__aside"><section><div className="calendar-ui__aside-head"><div><h2>{selectedKey === todayKey ? "Today" : selectedDate.toLocaleDateString([], {weekday:"long"})}</h2><p>{selectedDate.toLocaleDateString([], {weekday:"short",month:"short",day:"numeric",year:"numeric"})}</p></div><div><button onClick={() => setSelectedKey(dayKey(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),selectedDate.getDate()-1)))} aria-label="Previous day"><Icons.ChevronLeft size={16}/></button><button onClick={() => setSelectedKey(dayKey(new Date(selectedDate.getFullYear(),selectedDate.getMonth(),selectedDate.getDate()+1)))} aria-label="Next day"><Icons.ChevronRight size={16}/></button></div></div><div className="calendar-ui__today-list">{selectedEvents.length ? selectedEvents.map(event => <button key={event.id} onClick={() => onEdit(event)}><span className={`calendar-ui__dot calendar-ui__dot--${tone(event)}`}/><time>{clock(event.starts_at)}<small>{clock(event.ends_at)}</small></time><span><strong>{String(event.title)}</strong><small>{String(event.description ?? "Event")}</small></span></button>) : <p>No events on this day.</p>}</div><button className="calendar-ui__add" onClick={() => createForDay(selectedKey)}><Icons.Plus size={16}/> Add event</button></section><section className="calendar-ui__upcoming"><div className="calendar-ui__aside-head"><h2>Upcoming <small>(Next 7 days)</small></h2><button onClick={() => chooseView("agenda")}>View all</button></div>{upcoming.length ? upcoming.slice(0,5).map(event => <button className="calendar-ui__upcoming-row" key={event.id} onClick={() => onEdit(event)}><time>{at(event.starts_at).toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"})}</time><span><i className={`calendar-ui__dot calendar-ui__dot--${tone(event)}`}/><strong>{String(event.title)}</strong><small>{clock(event.starts_at)} – {clock(event.ends_at)}</small></span></button>) : <p className="calendar-ui__upcoming-empty">No events in the next 7 days.</p>}</section></aside></div>
  </div>;
}
