// ---------------------------------------------------------------------------
// DashboardTab - Native React implementation of the Dashboard view
// ---------------------------------------------------------------------------
// Requirements: 2.1, 2.4, 7.1

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SkeletonCard } from '@admini/ui';
import {
  getTasks,
  getActivityEvents,
  getDashboardKPIs,
  sortByUrgency,
} from '../services/dashboardService';
import type { DashboardTask, ActivityEvent, DashboardKPIs } from '../types';
import { RecommendationsWidget } from './RecommendationsWidget';
import { getTodayCalendarEvents, type CalendarEvent } from '../services/googleIntegrationService';
import {
  parseLocalDate as parseLocalDateShared,
  getTimeGreeting as getTimeGreetingShared,
  filterTodayEvents,
  defaultRegistry,
  formatActivityAction as formatActivityActionShared,
} from '@admini/shared';
import { getLocalEvents } from '../services/localEventService';
import { mergeEvents } from '../services/calendarMerge';
import { buildActivityFeed } from '../services/activityFeed';
// BadgesSection and BadgesPanel removed - replaced with compact achievement indicator

// Re-export sortByUrgency for testing and backward compatibility
export { sortByUrgency } from '../services/dashboardService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardTabProps {
  userName: string;
  userId?: string;
  organizationId?: string;
  onNavigateToTab?: (tabId: string) => void;
  onTabChange?: (tabId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a time-appropriate greeting based on the current hour.
 * Delegates to @admini/shared. Kept exported for backward compatibility.
 */
export function getTimeGreeting(): string {
  return getTimeGreetingShared();
}

// parseLocalDate is now imported from @admini/shared (as parseLocalDateShared).
// Local alias for use in this file:
const parseLocalDate = parseLocalDateShared;



// formatActivityAction is now imported from @admini/shared (as formatActivityActionShared).
// Local alias for use in this file:
const formatActivityAction = formatActivityActionShared;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardTab({ userName, userId, organizationId, onNavigateToTab, onTabChange }: DashboardTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [dashCalMonth, setDashCalMonth] = useState(new Date());
  const [showDashEvent, setShowDashEvent] = useState(false);
  const [dashEventTitle, setDashEventTitle] = useState('');
  const [dashEventDate, setDashEventDate] = useState('');
  const [dashEventTime, setDashEventTime] = useState('');
  const [unlockedCount, setUnlockedCount] = useState(0);
  const totalBadges = 9; // total badge count

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, eventsData, kpisData] = await Promise.all([
        getTasks(),
        getActivityEvents(),
        getDashboardKPIs(),
      ]);
      setTasks(tasksData);
      setEvents(eventsData);
      setKpis(kpisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const localEvents = getLocalEvents();
    getTodayCalendarEvents().then(googleEvents => {
      const merged = mergeEvents(googleEvents, localEvents);
      const todayEvents = filterTodayEvents(merged);
      setCalendarEvents(todayEvents as CalendarEvent[]);
    }).catch(() => {
      // Google fetch failed - degrade gracefully with local events only
      const merged = mergeEvents([], localEvents);
      const todayEvents = filterTodayEvents(merged);
      setCalendarEvents(todayEvents as CalendarEvent[]);
    });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admini_badges');
      const badges = raw ? JSON.parse(raw) : {};
      setUnlockedCount(Object.keys(badges).length);
    } catch { /* ignore */ }
  }, []);

  // -------------------------------------------------------------------------
  // Computed data
  // -------------------------------------------------------------------------

  /** Open tasks sorted by urgency for the priority queue. */
  const priorityQueue = useMemo(
    () => tasks.filter((t) => t.status === 'open').sort(sortByUrgency),
    [tasks],
  );

  /** Activity events sorted in reverse chronological order. */
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0)),
    [events],
  );


  /** Activity feed built using buildActivityFeed from the activityFeed service. */
  const activityFeedItems = useMemo(
    () => buildActivityFeed(events, tasks),
    [events, tasks],
  );

  /** Events to display: first 3 by default, up to 20 when expanded. */
  const visibleEvents = useMemo(
    () => showAllEvents ? sortedEvents.slice(0, 20) : sortedEvents.slice(0, 3),
    [sortedEvents, showAllEvents],
  );

  // Suppress unused variable warnings - kept for backward compatibility
  void visibleEvents;
  void onNavigateToTab;
  void defaultRegistry;
  void dashCalMonth;
  void kpis;

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="dashboard-tab dashboard-tab--loading" aria-busy="true">
        <SkeletonCard height={80} />
        <SkeletonCard height={160} />
        <SkeletonCard height={120} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="dashboard-tab dashboard-tab--error" role="alert">
        <div className="dashboard-tab__error-banner">
          <p>{error}</p>
          <button
            type="button"
            className="dashboard-tab__retry-btn"
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------


  // Computed: task groups
  const blockedTasks = tasks.filter(t => t.status === 'archived');
  const highPriorityTasks = priorityQueue.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const todayStr = new Date().toDateString();
  const dueTodayTasks = tasks.filter(t => t.status !== 'completed' && t.dueAt && parseLocalDate(t.dueAt).toDateString() === todayStr);
  const nowDate = new Date();
  const in7Days = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 7);
  const comingDueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.dueAt) return false;
    const due = parseLocalDate(t.dueAt);
    return due > nowDate && due <= in7Days;
  });

  return (
    <div className="dashboard-tab dashboard-tab--two-col">
      {/* Top Bar */}
      <header className="dashboard-tab__topbar">
        <h1 className="dashboard-tab__greeting-text">{getTimeGreeting()}, <strong>{userName}</strong></h1>
        <div className="dashboard-tab__quick-actions-bar">
          <span className="dashboard-tab__qa-label">QUICK ACTIONS</span>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => onTabChange?.('capture')}>Record a Capture</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => { localStorage.setItem('admini_capture_mode', 'tap'); onTabChange?.('capture'); }}>Quick Tap Capture</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => { localStorage.setItem('admini_tasks_view', 'calendar'); onTabChange?.('tasks'); }}>See Task Calendar</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => onTabChange?.('admin')}>Update Roster</button>
        </div>
        <div className="dashboard-tab__level-badge" onClick={() => setShowAchievements(true)} style={{ cursor: "pointer" }}>
          <span className="dashboard-tab__level-num">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__level-sub">{unlockedCount}/{totalBadges} badges</span>
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="dashboard-tab__columns">
        {/* LEFT: Task sections */}
        <div className="dashboard-tab__left">
          <section className="dashboard-tab__card dashboard-tab__card--high">
            <h2 className="dashboard-tab__card-title">High Priority</h2>
            {highPriorityTasks.length === 0 ? <p className="dashboard-tab__empty">No high priority tasks</p> : (
              <ul className="dashboard-tab__card-list">
                {highPriorityTasks.slice(0, 5).map(task => (
                  <li key={task.id} className="dashboard-tab__card-item" onClick={() => onTabChange?.('tasks')}>
                    <span>{task.title}</span>
                    <span className="dashboard-tab__card-due">{task.dueAt && parseLocalDate(task.dueAt).toDateString() === todayStr ? 'Today' : task.dueAt ? parseLocalDate(task.dueAt).toLocaleDateString(undefined, {month:'short',day:'numeric'}) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-tab__card dashboard-tab__card--due-today">
            <h2 className="dashboard-tab__card-title">Due Today</h2>
            {dueTodayTasks.length === 0 ? <p className="dashboard-tab__empty">Nothing due today</p> : (
              <ul className="dashboard-tab__card-list">
                {dueTodayTasks.map(task => (
                  <li key={task.id} className="dashboard-tab__card-item" onClick={() => onTabChange?.('tasks')}>
                    <span>{task.title}</span>
                    <span className="dashboard-tab__card-due">{task.dueAt ? parseLocalDate(task.dueAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-tab__card dashboard-tab__card--coming">
            <h2 className="dashboard-tab__card-title">Coming Due</h2>
            {comingDueTasks.length === 0 ? <p className="dashboard-tab__empty">Nothing coming due</p> : (
              <ul className="dashboard-tab__card-list">
                {comingDueTasks.slice(0, 5).map(task => (
                  <li key={task.id} className="dashboard-tab__card-item" onClick={() => onTabChange?.('tasks')}>
                    <span>{task.title}</span>
                    <span className="dashboard-tab__card-due">{parseLocalDate(task.dueAt!).toLocaleDateString(undefined, {month:'short',day:'numeric'})}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-tab__card dashboard-tab__card--blocked">
            <h2 className="dashboard-tab__card-title">Blocked Tasks {blockedTasks.length > 0 && <span className="dashboard-tab__blocked-badge">{blockedTasks.length}</span>}</h2>
            {blockedTasks.length === 0 ? <p className="dashboard-tab__empty">No blocked tasks</p> : (
              <ul className="dashboard-tab__card-list">
                {blockedTasks.slice(0, 5).map(task => (
                  <li key={task.id} className="dashboard-tab__card-item dashboard-tab__card-item--blocked" onClick={() => onTabChange?.('tasks')}>
                    <span>{task.title}</span>
                    <span className="dashboard-tab__card-blocked-reason">{task.description || 'Blocked'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {userId && organizationId && (
            <section className="dashboard-tab__card dashboard-tab__card--suggested">
              <RecommendationsWidget userId={userId} organizationId={organizationId} />
            </section>
          )}
        </div>

        {/* RIGHT: Calendar + Schedule + Activity */}
        <div className="dashboard-tab__right">
          <section className="dashboard-tab__card dashboard-tab__card--calendar">
            <div className="dashboard-tab__mini-cal-header">
              <span>{new Date().toLocaleDateString(undefined, {month:'long',year:'numeric'})}</span>
            </div>
            <div className="dashboard-tab__mini-cal-grid">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="dashboard-tab__mini-cal-dow">{d}</span>)}
              {(() => {
                const n = new Date();
                const first = new Date(n.getFullYear(), n.getMonth(), 1);
                const offset = first.getDay();
                const dim = new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
                const todayDate = new Date();
                const cells: React.ReactNode[] = [];
                for (let i=0; i<offset; i++) cells.push(<span key={'e'+i} />);
                for (let d=1; d<=dim; d++) {
                  const dt = new Date(n.getFullYear(), n.getMonth(), d);
                  const isToday = d === todayDate.getDate() && n.getMonth() === todayDate.getMonth() && n.getFullYear() === todayDate.getFullYear();
                  const hasTasks = tasks.some(t => t.dueAt && parseLocalDate(t.dueAt).toDateString() === dt.toDateString());
                  cells.push(<span key={d} className={'dashboard-tab__mini-cal-date' + (isToday ? ' --today' : '') + (hasTasks ? ' --has-tasks' : '')}>{d}</span>);
                }
                return cells;
              })()}
            </div>
          </section>

            <button type="button" style={{marginTop:"8px",background:"none",border:"1px solid #6B8E6B",color:"#4A6B4A",padding:"4px 12px",borderRadius:"20px",fontSize:"0.75rem",fontWeight:600,cursor:"pointer"}} onClick={() => setShowDashEvent(!showDashEvent)}>{showDashEvent ? "Cancel" : "+ Add Event"}</button>
            {showDashEvent && <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"8px",padding:"8px",background:"#F5F3EE",borderRadius:"8px"}}><input type="text" placeholder="Title" value={dashEventTitle} onChange={e=>setDashEventTitle(e.target.value)} style={{padding:"5px 8px",border:"1px solid #DFE6E9",borderRadius:"6px",fontSize:"0.75rem"}}/><input type="date" value={dashEventDate} onChange={e=>setDashEventDate(e.target.value)} style={{padding:"5px 8px",border:"1px solid #DFE6E9",borderRadius:"6px",fontSize:"0.75rem"}}/><input type="time" value={dashEventTime} onChange={e=>setDashEventTime(e.target.value)} style={{padding:"5px 8px",border:"1px solid #DFE6E9",borderRadius:"6px",fontSize:"0.75rem"}}/><button type="button" disabled={!dashEventTitle.trim()||!dashEventDate} style={{padding:"5px 12px",background:"#6B8E6B",color:"#fff",border:"none",borderRadius:"6px",fontSize:"0.75rem",fontWeight:600,cursor:"pointer"}} onClick={()=>{const ev={id:Date.now().toString(),summary:dashEventTitle.trim(),start:dashEventDate+(dashEventTime?"T"+dashEventTime+":00":""),end:""};const s=JSON.parse(localStorage.getItem("admini_local_events")||"[]");s.push(ev);localStorage.setItem("admini_local_events",JSON.stringify(s));setCalendarEvents(p=>[...p,ev]);setDashEventTitle("");setDashEventDate("");setDashEventTime("");setShowDashEvent(false);}}>Save</button></div>}
          <section className="dashboard-tab__card dashboard-tab__card--schedule">
            <div className="dashboard-tab__schedule-hdr">
              <h2 className="dashboard-tab__card-title">Today's Schedule</h2>
              <button type="button" className="dashboard-tab__edit-link" onClick={() => onTabChange?.('pulse')}>Edit</button>
            </div>
            {(() => {
              let dayBlocks: {period:string;time:string;activities:{label:string;type:string}[]}[] = [];
              try { const s = localStorage.getItem('admini_day_structure'); if(s) dayBlocks=JSON.parse(s); } catch{}
              if(!dayBlocks.length) dayBlocks=[{period:'Morning',time:'8:00 AM - 12:00 PM',activities:[{label:'Deep work',type:'focus'}]},{period:'Afternoon',time:'12:00 PM - 4:00 PM',activities:[{label:'Team sync',type:'meetings'}]},{period:'End of Day',time:'4:00 PM - 5:00 PM',activities:[{label:'Wrap-up',type:'wrap-up'}]}];
              return dayBlocks.map(block => (
                <div key={block.period} className="dashboard-tab__sched-block">
                  <div className="dashboard-tab__sched-period">
                    <strong>{block.period}</strong> <span>{block.time}</span>
                    {block.activities.map(a => <span key={a.label} className="dashboard-tab__sched-chip">{a.label}</span>)}
                  </div>
                  {calendarEvents.filter(ev => {
                    if(!ev.start) return false;
                    const h = new Date(ev.start).getHours();
                    if(block.period==='Morning') return h>=8&&h<12;
                    if(block.period==='Afternoon') return h>=12&&h<16;
                    return h>=16;
                  }).map(ev => (
                    <div key={ev.id} className="dashboard-tab__sched-event">
                      <span className="dashboard-tab__sched-event-time">{new Date(ev.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>
                      <span>{ev.summary}</span>{ev.id && !ev.id.startsWith("google") ? <button type="button" onClick={(e)=>{e.stopPropagation();const stored=JSON.parse(localStorage.getItem("admini_local_events")||"[]");const filtered=stored.filter((s:any)=>s.id!==ev.id);localStorage.setItem("admini_local_events",JSON.stringify(filtered));setCalendarEvents(prev=>prev.filter(x=>x.id!==ev.id));}} style={{marginLeft:"auto",background:"none",border:"none",color:"#D63031",cursor:"pointer",fontSize:"0.7rem"}}>Ã¯Â¿Â½</button> : null}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </section>

          <section className="dashboard-tab__card dashboard-tab__card--activity">
            <h2 className="dashboard-tab__card-title">Activity Feed</h2>
            <ul className="dashboard-tab__feed-list">
              {activityFeedItems.map(ev => (
                <li key={ev.id} className="dashboard-tab__feed-item">
                  <span className="dashboard-tab__feed-icon">{ev.action==='create'?'\u2713':'\u25CF'}</span>
                  <div className="dashboard-tab__feed-body">
                    <span>{formatActivityAction(ev)}</span>
                    <span className="dashboard-tab__feed-time">{new Date(ev.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      {showAchievements && <div onClick={()=>setShowAchievements(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"60px"}}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"16px",width:"min(480px,92vw)",maxHeight:"80vh",overflowY:"auto",padding:"24px",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}><div><h2 style={{fontSize:"1.25rem",fontWeight:700,margin:0}}>Achievements</h2><p style={{fontSize:"0.8rem",color:"#636E72",margin:"2px 0"}}>Level {Math.floor(unlockedCount/2)+1} - {unlockedCount} of {totalBadges} earned</p></div><button type="button" onClick={()=>setShowAchievements(false)} style={{background:"none",border:"none",fontSize:"1.5rem",cursor:"pointer"}}>&times;</button></div><div style={{height:8,background:"#E8E5DE",borderRadius:4,overflow:"hidden",marginBottom:20}}><div style={{height:"100%",background:"#E6A817",width:(unlockedCount/totalBadges*100)+"%"}} /></div>{(()=>{const b=JSON.parse(localStorage.getItem("admini_badges")||"{}");const defs=[{id:"first-capture",icon:"\uD83C\uDFA4",label:"First Capture",desc:"Record your first voice or tap capture"},{id:"first-task",icon:"\u2705",label:"Task Master",desc:"Create your first task"},{id:"five-tasks",icon:"\uD83C\uDF1F",label:"Getting Going",desc:"Complete 5 tasks"},{id:"ten-tasks",icon:"\uD83D\uDD25",label:"On Fire",desc:"Complete 10 tasks"},{id:"first-observation",icon:"\uD83D\uDC41",label:"Observer",desc:"Complete 10 classroom observations"},{id:"streak-3",icon:"\u26A1",label:"Capture Streak",desc:"Use voice capture 7 days in a row"},{id:"streak-7",icon:"\uD83D\uDCAA",label:"Delegator",desc:"Assign 5 tasks to team members"},{id:"first-note",icon:"\uD83D\uDCC5",label:"Calendar Pro",desc:"Keep your schedule updated for 2 weeks"},{id:"twenty-five",icon:"\u2B50",label:"Peak Admin",desc:"Earn all other achievements"}];const earned=defs.filter(d=>b[d.id]);const locked=defs.filter(d=>!b[d.id]);return(<>{earned.length>0&&<div style={{marginBottom:20}}><h3 style={{fontSize:"0.7rem",fontWeight:700,letterSpacing:"0.08em",color:"#636E72",margin:"0 0 10px"}}>EARNED</h3>{earned.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,marginBottom:8,background:"#FDFCF5",border:"1px solid #F0E9D0"}}><span style={{fontSize:"1.5rem"}}>{d.icon}</span><div style={{flex:1}}><strong>{d.label}</strong><br/><span style={{fontSize:"0.75rem",color:"#636E72"}}>{d.desc}</span></div><span style={{fontSize:"0.7rem",color:"#E6A817",fontWeight:600}}>Earned {new Date(b[d.id]).toLocaleDateString()}</span></div>)}</div>}{locked.length>0&&<div><h3 style={{fontSize:"0.7rem",fontWeight:700,letterSpacing:"0.08em",color:"#636E72",margin:"0 0 10px"}}>LOCKED</h3>{locked.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,marginBottom:8,background:"#F8F8F6",border:"1px solid #EEEDEA",opacity:0.7}}><span style={{fontSize:"1.5rem"}}>{d.icon}</span><div style={{flex:1}}><strong>{d.label}</strong><br/><span style={{fontSize:"0.75rem",color:"#636E72"}}>{d.desc}</span></div></div>)}</div>}</>);})()}</div></div>}
    </div>
  );
}