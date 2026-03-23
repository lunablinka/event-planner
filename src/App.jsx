import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return 'No date'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 86400000)
}
function daysLabel(d) {
  const n = daysUntil(d)
  if (n === null) return ''
  if (n > 0) return `${n}d away`
  if (n === 0) return 'Today!'
  return `${Math.abs(n)}d ago`
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

// ── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1a2e; --paper: #f5f0e8; --cream: #ede8dc;
    --accent: #c84b31; --accent2: #2d6a4f; --gold: #e9a820;
    --muted: #7a7265; --card: #faf7f2; --border: #d4cfc6;
    --shadow: 0 2px 12px rgba(26,26,46,0.08);
  }
  html, body, #root { height: 100%; }
  body { font-family: 'DM Sans', sans-serif; background: var(--paper); color: var(--ink); }
  .eop-wrap { display: flex; flex-direction: column; height: 100vh; }

  .eop-header { background: var(--ink); color: var(--paper); padding: 20px 32px 16px; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid var(--accent); flex-shrink: 0; }
  .eop-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.75rem; line-height: 1; }
  .eop-header h1 em { color: var(--gold); font-style: italic; }
  .eop-header-sub { font-family: 'DM Mono', monospace; font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .eop-header-right { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: var(--muted); text-align: right; }
  .live-badge { background: var(--accent2); color: white; font-size: 0.58rem; padding: 2px 8px; letter-spacing: 0.08em; text-transform: uppercase; display: inline-block; margin-bottom: 4px; }

  .eop-body { display: flex; flex: 1; overflow: hidden; }
  .eop-sidebar { width: 300px; min-width: 300px; background: var(--cream); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 18px 14px; gap: 12px; overflow-y: auto; }
  .eop-content { flex: 1; overflow-y: auto; padding: 26px 34px; }

  .sidebar-label { font-family: 'DM Mono', monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .add-btn { width: 100%; padding: 10px; background: var(--accent); color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background 0.15s; }
  .add-btn:hover { background: #a83d27; }

  .ev-card { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--accent2); padding: 10px 12px; cursor: pointer; transition: box-shadow 0.15s; margin-bottom: 8px; }
  .ev-card:hover { box-shadow: var(--shadow); }
  .ev-card.active { border-left-color: var(--accent); box-shadow: var(--shadow); }
  .ev-card-name { font-weight: 500; font-size: 0.875rem; }
  .ev-card-meta { font-family: 'DM Mono', monospace; font-size: 0.63rem; color: var(--muted); margin-top: 3px; }
  .ev-tag { font-family: 'DM Mono', monospace; font-size: 0.57rem; padding: 2px 6px; background: var(--cream); border: 1px solid var(--border); color: var(--muted); text-transform: uppercase; display: inline-block; margin-top: 5px; }
  .prog-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 7px; }
  .prog-fill { height: 100%; background: var(--accent2); border-radius: 2px; }
  .prog-label { font-family: 'DM Mono', monospace; font-size: 0.58rem; color: var(--muted); margin-top: 2px; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px; gap: 10px; color: var(--muted); font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1rem; opacity: 0.6; }

  .det-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }
  .det-title { font-family: 'DM Serif Display', serif; font-size: 1.7rem; }
  .det-meta { font-family: 'DM Mono', monospace; font-size: 0.67rem; color: var(--muted); margin-top: 5px; display: flex; flex-wrap: wrap; gap: 12px; }
  .det-goal { font-size: 0.8rem; color: var(--muted); margin-top: 5px; }
  .det-actions { display: flex; gap: 7px; flex-shrink: 0; }
  .btn-sm { padding: 6px 13px; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--card); color: var(--ink); transition: background 0.15s; }
  .btn-sm:hover { background: var(--cream); }
  .btn-danger { color: var(--accent); border-color: var(--accent); }
  .btn-danger:hover { background: #fdf0ed; }
  .btn-sure { background: var(--accent) !important; color: white !important; border-color: var(--accent) !important; }

  .section { margin-bottom: 26px; }
  .sec-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 7px; margin-bottom: 12px; }
  .sec-title { font-family: 'DM Serif Display', serif; font-size: 1.05rem; }
  .sec-action { font-family: 'DM Mono', monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); background: none; border: none; cursor: pointer; }
  .sec-action:disabled { opacity: 0.45; cursor: default; }

  .notes-box { width: 100%; min-height: 70px; padding: 10px 12px; border: 1px solid var(--border); background: var(--card); font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: var(--ink); resize: none; line-height: 1.6; overflow: hidden; }
  .notes-box:focus { outline: 2px solid var(--accent2); }

  .task-item { display: flex; align-items: flex-start; gap: 9px; padding: 9px 12px; background: var(--card); border: 1px solid var(--border); margin-bottom: 6px; transition: opacity 0.2s; }
  .task-item.done { opacity: 0.45; }
  .task-item.done .task-text { text-decoration: line-through; }
  .task-cb { margin-top: 3px; accent-color: var(--accent2); width: 14px; height: 14px; flex-shrink: 0; cursor: pointer; }
  .task-body { flex: 1; }
  .task-text { font-size: 0.875rem; line-height: 1.4; }
  .task-due { font-family: 'DM Mono', monospace; font-size: 0.62rem; color: var(--muted); margin-top: 2px; }
  .task-due.overdue { color: var(--accent); }
  .task-icon-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; padding: 0 3px; flex-shrink: 0; }
  .task-icon-btn:hover { color: var(--accent2); }
  .task-icon-btn.del:hover { color: var(--accent); }

  .inline-edit { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
  .inline-edit input { padding: 4px 8px; border: 1px solid var(--accent2); background: var(--paper); font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--ink); }
  .inline-edit input[type=text] { flex: 1; min-width: 100px; }
  .inline-edit .save { padding: 4px 10px; background: var(--accent2); color: white; border: none; font-size: 0.75rem; cursor: pointer; }
  .inline-edit .cancel { padding: 4px 8px; background: none; border: 1px solid var(--border); color: var(--muted); font-size: 0.75rem; cursor: pointer; }

  .add-task-row { display: flex; gap: 7px; margin-top: 8px; }
  .add-task-row input { padding: 7px 10px; border: 1px solid var(--border); background: var(--card); font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--ink); }
  .add-task-row input[type=text] { flex: 1; }
  .add-task-row input:focus { outline: 2px solid var(--accent2); }
  .add-task-row button { padding: 7px 14px; background: var(--accent2); color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 500; cursor: pointer; }
  .add-task-row button:hover { background: #235a40; }

  .ai-panel { background: var(--ink); color: var(--paper); padding: 18px 22px; border-top: 3px solid var(--gold); }
  .ai-label { font-family: 'DM Mono', monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); margin-bottom: 10px; }
  .ai-output { font-size: 0.85rem; line-height: 1.7; white-space: pre-wrap; min-height: 50px; color: #e8e4dc; }
  .ai-btns { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
  .ai-btn { padding: 6px 12px; background: none; border: 1px solid var(--muted); color: var(--paper); font-family: 'DM Mono', monospace; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
  .ai-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); }
  .ai-btn:disabled { opacity: 0.45; cursor: default; }

  .modal-bg { position: fixed; inset: 0; background: rgba(26,26,46,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal { background: var(--paper); border-top: 3px solid var(--accent); padding: 26px; width: 100%; max-width: 430px; box-shadow: 0 8px 40px rgba(26,26,46,0.2); }
  .modal h2 { font-family: 'DM Serif Display', serif; font-size: 1.25rem; margin-bottom: 16px; }
  .form-group { margin-bottom: 11px; }
  .form-label { display: block; font-family: 'DM Mono', monospace; font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 4px; }
  .form-input { width: 100%; padding: 8px 10px; border: 1px solid var(--border); background: var(--card); font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: var(--ink); }
  .form-input:focus { outline: 2px solid var(--accent2); }
  .modal-actions { display: flex; gap: 9px; margin-top: 16px; }
  .modal-actions button { flex: 1; padding: 9px; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: #a83d27; }
  .btn-cancel-modal { background: var(--cream); color: var(--ink); border: 1px solid var(--border) !important; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--gold); border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 5px; }

  /* Password gate */
  .pw-wrap { min-height: 100vh; background: var(--ink); display: flex; align-items: center; justify-content: center; }
  .pw-box { background: var(--paper); border-top: 3px solid var(--accent); padding: 40px 36px; width: 100%; max-width: 380px; box-shadow: 0 8px 40px rgba(0,0,0,0.3); }
  .pw-box h1 { font-family: 'DM Serif Display', serif; font-size: 1.6rem; margin-bottom: 6px; }
  .pw-box h1 em { color: var(--accent); font-style: italic; }
  .pw-sub { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 24px; }
  .pw-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); background: var(--card); font-family: 'DM Sans', sans-serif; font-size: 0.95rem; color: var(--ink); margin-bottom: 10px; }
  .pw-input:focus { outline: 2px solid var(--accent2); }
  .pw-btn { width: 100%; padding: 11px; background: var(--accent); color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: background 0.15s; }
  .pw-btn:hover { background: #a83d27; }
  .pw-error { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--accent); margin-top: 8px; text-align: center; }
`

if (!document.getElementById('eop-styles')) {
  const s = document.createElement('style')
  s.id = 'eop-styles'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Event Form ────────────────────────────────────────────────────────────────
const TYPES = ['Conference','Networking Mixer','Trade Show','Panel / Speaker Event','Workshop','Other']

function EventForm({ data, onChange }) {
  return (
    <>
      {[['name','Event Name','e.g. TechConnect Summit 2026','text'],
        ['date','Date','','date'],
        ['location','Location','e.g. Raleigh Convention Center','text'],
        ['goal','Goal','e.g. Generate 10 warm leads','text']
      ].map(([k,l,p,t]) => (
        <div className="form-group" key={k}>
          <label className="form-label">{l}</label>
          <input className="form-input" type={t} placeholder={p} value={data[k]||''} onChange={e=>onChange(k,e.target.value)} />
        </div>
      ))}
      <div className="form-group">
        <label className="form-label">Type / Format</label>
        <select className="form-input" value={data.type||TYPES[0]} onChange={e=>onChange('type',e.target.value)}>
          {TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
    </>
  )
}

function Modal({ title, onClose, onSave, saveLabel='Save', children }) {
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <h2>{title}</h2>
        {children}
        <div className="modal-actions">
          <button className="btn-cancel-modal" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Password ─────────────────────────────────────────────────────────────────
const PASSWORD = 'OdumPlanner'  // ← change this to whatever you want

function PasswordGate({ onUnlock }) {
  const [val, setVal] = useState('')
  const [error, setError] = useState(false)
  const check = () => {
    if (val === PASSWORD) { sessionStorage.setItem('eop_auth', '1'); onUnlock() }
    else { setError(true); setVal('') }
  }
  return (
    <div className="pw-wrap">
      <div className="pw-box">
        <h1>Event <em>&amp; Outreach</em></h1>
        <div className="pw-sub">Professional Networking Planner</div>
        <input
          className="pw-input"
          type="password"
          placeholder="Enter password…"
          value={val}
          onChange={e=>{ setVal(e.target.value); setError(false) }}
          onKeyDown={e=>e.key==='Enter'&&check()}
          autoFocus
        />
        <button className="pw-btn" onClick={check}>Enter</button>
        {error && <div className="pw-error">Incorrect password. Try again.</div>}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem('eop_auth'))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [formData, setFormData] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [newTask, setNewTask] = useState({ text: '', due: '' })
  const [notesDraft, setNotesDraft] = useState('')
  const [aiOutput, setAiOutput] = useState('Ask me to draft an outreach plan, pre-event message, or follow-up strategy for this event.')
  const [aiLoading, setAiLoading] = useState(false)

  const activeEvent = events.find(e => e.id === activeId) || null

  // ── Firebase real-time listener ──
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'events'), snapshot => {
      const evs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      evs.sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))
      setEvents(evs)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    setNotesDraft(activeEvent?.notes || '')
    setAiOutput('Ask me to draft an outreach plan, pre-event message, or follow-up strategy for this event.')
    setDeleteConfirm(false)
    setEditingTask(null)
  }, [activeId])

  // ── CRUD ──
  const handleAdd = async () => {
    if (!formData.name?.trim()) return alert('Event name is required.')
    const ref = await addDoc(collection(db, 'events'), {
      ...formData,
      tasks: [],
      notes: '',
      createdAt: serverTimestamp()
    })
    setActiveId(ref.id)
    setShowAdd(false)
    setFormData({})
  }

  const handleEdit = async () => {
    if (!formData.name?.trim()) return alert('Event name is required.')
    await updateDoc(doc(db, 'events', activeId), {
      name: formData.name,
      date: formData.date || '',
      location: formData.location || '',
      type: formData.type || TYPES[0],
      goal: formData.goal || ''
    })
    setShowEdit(false)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 3000)
      return
    }
    await deleteDoc(doc(db, 'events', activeId))
    setActiveId(null)
    setDeleteConfirm(false)
  }

  const openEdit = () => { setFormData({ ...activeEvent }); setShowEdit(true) }

  // ── Tasks ──
  const saveTasks = (tasks) => updateDoc(doc(db, 'events', activeId), { tasks })

  const addTask = () => {
    if (!newTask.text.trim()) return
    const tasks = [...(activeEvent.tasks||[]), { id: uid(), text: newTask.text.trim(), due: newTask.due, done: false }]
    saveTasks(tasks)
    setNewTask({ text: '', due: '' })
  }

  const toggleTask = (i) => {
    const tasks = [...(activeEvent.tasks||[])]
    tasks[i] = { ...tasks[i], done: !tasks[i].done }
    saveTasks(tasks)
  }

  const deleteTask = (i) => {
    const tasks = (activeEvent.tasks||[]).filter((_,idx) => idx !== i)
    saveTasks(tasks)
  }

  const saveTaskEdit = (i) => {
    if (!editingTask.text.trim()) return
    const tasks = [...(activeEvent.tasks||[])]
    tasks[i] = { ...tasks[i], text: editingTask.text, due: editingTask.due }
    saveTasks(tasks)
    setEditingTask(null)
  }

  // ── Notes ──
  const saveNotes = () => updateDoc(doc(db, 'events', activeId), { notes: notesDraft })

  // ── AI ──
  const aiAction = async (type) => {
    const ev = activeEvent
    setAiLoading(true)
    setAiOutput('Generating…')
    const prompts = {
      'pre-event': `You are a professional networking strategist. Write a concise, actionable pre-event outreach plan for:\nEvent: ${ev.name} (${ev.type}) on ${fmtDate(ev.date)} in ${ev.location||'TBD'}.\nGoal: ${ev.goal||'Network effectively'}.\nNotes: ${ev.notes||'None'}.\nBe specific and practical. 200 words max.`,
      'followup': `Write a post-event follow-up strategy for: ${ev.name} (${ev.type}).\nGoal: ${ev.goal||'Build lasting connections'}.\nInclude timing, channels, and messaging. 200 words max.`,
      'linkedin': `Write a short warm LinkedIn connection message to someone you met at ${ev.name}. Under 100 words, professional but personal.`,
      'summary': `Create a concise event brief for: ${ev.name}\nType: ${ev.type} | Date: ${fmtDate(ev.date)} | Location: ${ev.location||'TBD'}\nGoal: ${ev.goal||'Networking'}\nQuick-reference format, readable in 30 seconds.`
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompts[type] }] })
      })
      const data = await res.json()
      setAiOutput(data.content.map(b => b.text||'').join(''))
    } catch { setAiOutput('Error generating response. Please try again.') }
    setAiLoading(false)
  }

  const generateTasks = async () => {
    const ev = activeEvent
    setAiLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const prompt = `Generate a practical outreach task checklist for:\n- Event: ${ev.name} (${ev.type})\n- Date: ${ev.date||'TBD'}\n- Location: ${ev.location||'TBD'}\n- Goal: ${ev.goal||'Network effectively'}\n- Today: ${today}\n\nReturn ONLY a JSON array: [{"text":"...","due":"YYYY-MM-DD or null"}]\n6-10 tasks covering pre-event, day-of, and post-event. No markdown.`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content.map(b => b.text||'').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      const tasks = [...(activeEvent.tasks||[]), ...parsed.map(t => ({ id: uid(), text: t.text, due: t.due||'', done: false }))]
      saveTasks(tasks)
    } catch(e) { console.error(e) }
    setAiLoading(false)
  }

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  if (!unlocked) return <PasswordGate onUnlock={()=>setUnlocked(true)} />

  return (
    <div className="eop-wrap">
      <header className="eop-header">
        <div>
          <h1>Event <em>&amp; Outreach</em> Planner</h1>
          <div className="eop-header-sub">Professional Networking Command Center</div>
        </div>
        <div className="eop-header-right">
          <div><span className="live-badge">● Live</span></div>
          <div>{today}</div>
        </div>
      </header>

      <div className="eop-body">
        <aside className="eop-sidebar">
          <div>
            <div className="sidebar-label">Events</div>
            <button className="add-btn" style={{marginTop:8}} onClick={()=>setShowAdd(true)}>＋ Add Event</button>
          </div>
          {loading ? (
            <p style={{fontSize:'0.78rem',color:'var(--muted)',textAlign:'center',padding:'16px 0'}}>Loading…</p>
          ) : events.length === 0 ? (
            <p style={{fontSize:'0.78rem',color:'var(--muted)',textAlign:'center',padding:'16px 0'}}>No events yet</p>
          ) : events.map(ev => {
            const tasks = ev.tasks||[]
            const done = tasks.filter(t=>t.done).length
            const pct = tasks.length ? Math.round(done/tasks.length*100) : 0
            const dl = daysLabel(ev.date)
            return (
              <div key={ev.id} className={`ev-card${activeId===ev.id?' active':''}`} onClick={()=>setActiveId(ev.id)}>
                <div className="ev-card-name">{ev.name}</div>
                <div className="ev-card-meta">{fmtDate(ev.date)} · {ev.location||'TBD'}{dl?` · ${dl}`:''}</div>
                <span className="ev-tag">{ev.type}</span>
                {tasks.length > 0 && (
                  <>
                    <div className="prog-bar"><div className="prog-fill" style={{width:`${pct}%`}}/></div>
                    <div className="prog-label">{done}/{tasks.length} tasks done</div>
                  </>
                )}
              </div>
            )
          })}
        </aside>

        <main className="eop-content">
          {!activeEvent ? (
            <div className="empty-state">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              Select or add an event to get started
            </div>
          ) : (
            <>
              <div className="det-header">
                <div>
                  <div className="det-title">{activeEvent.name}</div>
                  <div className="det-meta">
                    <span>📅 {fmtDate(activeEvent.date)}</span>
                    <span>📍 {activeEvent.location||'TBD'}</span>
                    <span>🏷 {activeEvent.type}</span>
                    {daysLabel(activeEvent.date) && <span style={{color:'var(--accent)',fontWeight:500}}>{daysLabel(activeEvent.date)}</span>}
                  </div>
                  {activeEvent.goal && <div className="det-goal">🎯 {activeEvent.goal}</div>}
                </div>
                <div className="det-actions">
                  <button className="btn-sm" onClick={openEdit}>Edit</button>
                  <button className={`btn-sm btn-danger${deleteConfirm?' btn-sure':''}`} onClick={handleDelete}>
                    {deleteConfirm ? 'Sure?' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="section">
                <div className="sec-header"><span className="sec-title">Notes</span></div>
                <textarea
                  className="notes-box"
                  value={notesDraft}
                  placeholder="Add context, research, key contacts to meet…"
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                  onChange={e => {
                    setNotesDraft(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onBlur={saveNotes}
                />
              </div>

              <div className="section">
                <div className="sec-header">
                  <span className="sec-title">Outreach Timeline &amp; Tasks</span>
                  <button className="sec-action" onClick={generateTasks} disabled={aiLoading}>
                    {aiLoading ? '⏳ Generating…' : '✦ Generate with AI'}
                  </button>
                </div>
                {(activeEvent.tasks||[]).length === 0 && (
                  <p style={{fontSize:'0.78rem',color:'var(--muted)',padding:'6px 0 10px'}}>No tasks yet. Add one below or use AI to generate.</p>
                )}
                {(activeEvent.tasks||[]).map((t,i) => {
                  const tod = new Date().toISOString().split('T')[0]
                  const overdue = t.due && !t.done && t.due < tod
                  const isEditing = editingTask?.index === i
                  return (
                    <div key={t.id||i} className={`task-item${t.done?' done':''}`}>
                      <input type="checkbox" className="task-cb" checked={!!t.done} onChange={()=>toggleTask(i)}/>
                      <div className="task-body">
                        {isEditing ? (
                          <div className="inline-edit">
                            <input type="text" value={editingTask.text} onChange={e=>setEditingTask({...editingTask,text:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')saveTaskEdit(i);if(e.key==='Escape')setEditingTask(null)}} autoFocus/>
                            <input type="date" value={editingTask.due||''} onChange={e=>setEditingTask({...editingTask,due:e.target.value})}/>
                            <button className="save" onClick={()=>saveTaskEdit(i)}>Save</button>
                            <button className="cancel" onClick={()=>setEditingTask(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <div className="task-text">{t.text}</div>
                            {t.due && <div className={`task-due${overdue?' overdue':''}`}>Due: {fmtDate(t.due)}{overdue?' — OVERDUE':''}</div>}
                          </>
                        )}
                      </div>
                      {!isEditing && <>
                        <button className="task-icon-btn" onClick={()=>setEditingTask({index:i,text:t.text,due:t.due||''})}>✎</button>
                        <button className="task-icon-btn del" onClick={()=>deleteTask(i)}>×</button>
                      </>}
                    </div>
                  )
                })}
                <div className="add-task-row">
                  <input type="text" placeholder="Add a task…" value={newTask.text} onChange={e=>setNewTask({...newTask,text:e.target.value})} onKeyDown={e=>e.key==='Enter'&&addTask()}/>
                  <input type="date" value={newTask.due} onChange={e=>setNewTask({...newTask,due:e.target.value})}/>
                  <button onClick={addTask}>Add</button>
                </div>
              </div>

              <div className="ai-panel">
                <div className="ai-label">✦ AI Outreach Assistant</div>
                <div className="ai-output">{aiOutput}</div>
                <div className="ai-btns">
                  {[['pre-event','Pre-Event Outreach'],['followup','Post-Event Follow-Up'],['linkedin','LinkedIn Message'],['summary','Event Brief']].map(([k,l])=>(
                    <button key={k} className="ai-btn" disabled={aiLoading} onClick={()=>aiAction(k)}>{l}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {showAdd && (
        <Modal title="Add New Event" onClose={()=>{setShowAdd(false);setFormData({})}} onSave={handleAdd} saveLabel="Add Event">
          <EventForm data={formData} onChange={(k,v)=>setFormData(f=>({...f,[k]:v}))}/>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Edit Event" onClose={()=>setShowEdit(false)} onSave={handleEdit} saveLabel="Save Changes">
          <EventForm data={formData} onChange={(k,v)=>setFormData(f=>({...f,[k]:v}))}/>
        </Modal>
      )}
    </div>
  )
}
