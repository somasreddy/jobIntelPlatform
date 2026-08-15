"use client";
import { ApplicationStatus } from "@/lib/types";
import { useAppData } from "@/lib/AppDataContext";
import {
  Building2, ArrowUpRight, Bell, BellOff, AlertCircle,
  Mail, Plus, Trash2, Edit3, CheckCircle2, Clock, AlertTriangle,
  MessageSquare, Phone, Linkedin, Link2, Filter, Search,
  ChevronDown, ChevronUp, X, Users, TrendingUp, Calendar,
  KanbanSquare, History, FileText, Copy, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { toast } from "sonner";
import AnimatedStat from "@/components/AnimatedStat";
import ApplicationsFunnelChart from "@/components/ApplicationsFunnelChart";
import { motionTransition } from "@/lib/motion-tokens";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Application Tracker types ────────────────────────────────────────────────
const COLUMNS: { id: ApplicationStatus; title: string; color: string }[] = [
  { id: "Discovered",         title: "Discovered",         color: "text-slate-400" },
  { id: "Saved",              title: "Saved",              color: "text-slate-300" },
  { id: "Shortlisted",        title: "Shortlisted",        color: "text-blue-400" },
  { id: "Tailoring",          title: "Tailoring",          color: "text-violet-400" },
  { id: "Ready to Apply",     title: "Ready",              color: "text-indigo-300" },
  { id: "Applied",            title: "Applied",            color: "text-indigo-400" },
  { id: "Recruiter Contacted",title: "Recruiter Contacted",color: "text-cyan-400" },
  { id: "Screening",          title: "Screening",          color: "text-sky-400" },
  { id: "Assessment",         title: "Assessment",         color: "text-amber-400" },
  { id: "Interview",          title: "Interview",          color: "text-orange-400" },
  { id: "Final Interview",    title: "Final Interview",    color: "text-yellow-300" },
  { id: "Offer",              title: "Offer",              color: "text-emerald-400" },
  { id: "Rejected",           title: "Rejected",           color: "text-rose-400" },
  { id: "Archived",           title: "Archived",           color: "text-slate-500" },
];

// Forward progression through the pipeline, used for the stage-conversion
// analytics below. "Rejected" is deliberately excluded — it's an exit state
// that can happen from any prior stage, and this page only has a status
// snapshot (not per-application stage-transition history), so there is no
// honest way to attribute a rejected application to a specific stage.
const FUNNEL_ORDER: ApplicationStatus[] = ["Saved", "Applied", "Assessment", "Interview", "Offer"];

const FOLLOWUP_STORAGE_KEY = "trackerFollowUpDates";
function loadFollowUpDates(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(FOLLOWUP_STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveFollowUpDate(appId: string, date: string) {
  const c = loadFollowUpDates(); c[appId] = date;
  localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(c));
}
function removeFollowUpDate(appId: string) {
  const c = loadFollowUpDates(); delete c[appId];
  localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(c));
}

// ─── Activity Log ──────────────────────────────────────────────────────────
// Real, timestamped events for both applications and Outreach CRM contacts.
// Applications are real Postgres-backed rows (see backend/api/activity_log.py
// + models.database.ActivityLog), so entries logged against a real
// (backend-issued) application UUID are best-effort synced to the backend —
// that sync degrades silently to local-only when the backend is unreachable,
// same resilience pattern as the rest of this page. Outreach CRM contacts
// are a client-side-only concept (see Contact below — no backend table
// exists for them), so contact activity stays in localStorage only; this is
// disclosed rather than fabricating a backend history for them.
type ActivityAction =
  | "status_change" | "follow_up_set" | "follow_up_cleared" | "follow_up_completed"
  | "note_added" | "contact_status_change" | "outreach_logged" | "reminder_sent";

interface ActivityEntry {
  id: string;
  entityType: "application" | "contact";
  entityId: string;
  action: ActivityAction;
  note?: string;
  at: string; // ISO timestamp
}

const ACTIVITY_LOG_STORAGE_KEY = "ji_activity_log";
const MAX_ENTRIES_PER_ENTITY = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isRealUuid(id: string) { return UUID_RE.test(id); }

function loadActivityLog(): Record<string, ActivityEntry[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY) || "{}"); } catch { return {}; }
}
function persistActivityLog(log: Record<string, ActivityEntry[]>) {
  try { localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(log)); } catch {}
}

const ACTIVITY_META: Record<ActivityAction, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  status_change:          { label: "Status changed",       icon: KanbanSquare,  color: "text-indigo-400" },
  follow_up_set:          { label: "Follow-up set",         icon: Bell,          color: "text-amber-400" },
  follow_up_cleared:      { label: "Follow-up cleared",     icon: BellOff,       color: "text-slate-400" },
  follow_up_completed:    { label: "Follow-up completed",   icon: CheckCircle2,  color: "text-emerald-400" },
  note_added:             { label: "Note added",            icon: Edit3,         color: "text-cyan-400" },
  contact_status_change:  { label: "Contact updated",       icon: Users,         color: "text-violet-400" },
  outreach_logged:        { label: "Outreach logged",       icon: Mail,          color: "text-blue-400" },
  reminder_sent:          { label: "Reminder sent",         icon: AlertCircle,   color: "text-orange-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Dedupe key store so the same contact follow-up doesn't re-fire a real
// Notification (see the "newly due/overdue" effect in PipelinePage) every
// time the page reloads.
const NOTIFIED_CONTACT_FOLLOWUPS_KEY = "ji_notified_contact_followups";
function loadNotifiedFollowupKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_CONTACT_FOLLOWUPS_KEY) || "[]")); } catch { return new Set(); }
}
function persistNotifiedFollowupKeys(keys: Set<string>) {
  try { localStorage.setItem(NOTIFIED_CONTACT_FOLLOWUPS_KEY, JSON.stringify([...keys])); } catch {}
}

/** Compact, reusable activity timeline — reused for both application cards and contact rows. */
function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[11px] text-slate-500 italic">No activity logged yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      {entries.slice(0, 6).map(e => {
        const meta = ACTIVITY_META[e.action];
        const Icon = meta.icon;
        return (
          <div key={e.id} className="flex items-start gap-2">
            <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${meta.color}`} />
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-300">{e.note || meta.label}</span>
              <span className="text-[10px] text-slate-600">· {timeAgo(e.at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Outreach CRM types ───────────────────────────────────────────────────────
type ContactStatus = "identified" | "reached_out" | "replied" | "call_scheduled" | "interview" | "offer" | "rejected" | "ghosted";
type Channel = "email" | "linkedin" | "phone" | "referral" | "other";

interface FollowUp { id: string; date: string; note: string; done: boolean }
interface Contact {
  id: string; name: string; title: string; company: string;
  email?: string; linkedin?: string; channel: Channel; status: ContactStatus;
  notes: string; followUps: FollowUp[]; createdAt: string; lastTouched: string;
}

const STATUS_META: Record<ContactStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{className?:string}> }> = {
  identified:     { label: "Identified",     color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",   icon: Users        },
  reached_out:    { label: "Reached Out",    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",     icon: Mail         },
  replied:        { label: "Replied",        color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20",     icon: MessageSquare},
  call_scheduled: { label: "Call Scheduled", color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20", icon: Phone        },
  interview:      { label: "Interview",      color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   icon: Calendar     },
  offer:          { label: "Offer",          color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  rejected:       { label: "Rejected",       color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",     icon: X            },
  ghosted:        { label: "Ghosted",        color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
};
const STATUSES: ContactStatus[] = ["identified","reached_out","replied","call_scheduled","interview","offer","rejected","ghosted"];
const CHANNEL_ICONS: Record<Channel, React.ComponentType<{className?:string}>> = {
  email: Mail, linkedin: Linkedin, phone: Phone, referral: Users, other: Link2,
};
const EMPTY_CONTACT: Omit<Contact, "id"|"createdAt"|"lastTouched"|"followUps"> = {
  name: "", title: "", company: "", email: "", linkedin: "", channel: "linkedin", status: "identified", notes: "",
};
function uid() { return Math.random().toString(36).slice(2, 10); }
function daysDiff(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
function isOverdue(c: Contact) { return c.followUps.filter(f => !f.done).some(f => new Date(f.date) < new Date()); }

// ─── Outreach Sequence Templates ──────────────────────────────────────────────
// A small, editable library of real message templates the user can pick,
// customize, and copy when reaching out. UI content only — no backend table,
// no automated sending. {{name}} / {{title}} / {{company}} are filled in from
// the contact being edited (see fillTemplate below) and everything remains
// editable before the user copies it out to send manually.
interface OutreachTemplate { id: string; name: string; description: string; body: string }

const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "initial-connection",
    name: "Initial connection",
    description: "First touch — introduce yourself and the role you're interested in.",
    body: `Hi {{name}},

I noticed you work on the team behind {{title}} at {{company}} and wanted to reach out directly. I'm exploring opportunities there and would love to hear about your experience on the team.

Would you be open to a quick 15-minute call sometime this week?

Best,
[Your name]`,
  },
  {
    id: "follow-up-no-response",
    name: "Follow-up after no response",
    description: "A light, low-pressure nudge after an earlier message went unanswered.",
    body: `Hi {{name}},

Just following up on my note from a bit ago — I know things get busy, so no worries if now isn't a good time.

I'm still very interested in {{title}} at {{company}} and would appreciate any pointers, even a quick reply.

Thanks either way,
[Your name]`,
  },
  {
    id: "post-interview-thank-you",
    name: "Post-interview thank you",
    description: "Send within a day of an interview to reinforce interest and rapport.",
    body: `Hi {{name}},

Thank you for taking the time to speak with me about {{title}} at {{company}} — I really enjoyed our conversation and learning more about the team's priorities.

Our discussion made me even more excited about the role. Please let me know if there's anything else I can provide to help with next steps.

Best,
[Your name]`,
  },
  {
    id: "referral-ask",
    name: "Referral ask",
    description: "Ask a warm contact for an internal referral or introduction.",
    body: `Hi {{name}},

Hope you're doing well! I saw {{company}} is hiring for {{title}} and immediately thought of you.

Would you be willing to refer me, or point me to the right person on the hiring team? Happy to send over my resume and a short blurb to make it easy.

Thanks so much,
[Your name]`,
  },
  {
    id: "reconnect-after-rejection",
    name: "Reconnect after rejection",
    description: "Stay on good terms and keep the door open for future roles.",
    body: `Hi {{name}},

Thanks again for the update on {{title}} — I appreciate you letting me know, even though it wasn't the outcome I'd hoped for.

I remain really interested in {{company}} and would love to stay in touch for future openings that might be a better fit. Would you mind if I reached out again down the line?

Best,
[Your name]`,
  },
];

/** Fills {{name}} / {{title}} / {{company}} placeholders from the contact being composed for. */
function fillTemplate(body: string, vars: { name: string; title: string; company: string }): string {
  return body
    .split("{{name}}").join(vars.name.trim() || "there")
    .split("{{title}}").join(vars.title.trim() || "the role")
    .split("{{company}}").join(vars.company.trim() || "your company");
}

// ─── Contact Form Modal ───────────────────────────────────────────────────────
function ContactModal({ initial, onSave, onClose, onTemplateUsed }: {
  initial: Contact | null; onSave: (c: Contact) => void; onClose: () => void;
  /** Fires when the user copies a filled-in template while editing an existing (already-saved) contact. */
  onTemplateUsed?: (contactId: string, templateName: string) => void;
}) {
  const [form, setForm] = useState(
    initial ? { name: initial.name, title: initial.title, company: initial.company, email: initial.email, linkedin: initial.linkedin, channel: initial.channel, status: initial.status, notes: initial.notes }
    : { ...EMPTY_CONTACT }
  );
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => {
    if (!form.name.trim() || !form.company.trim()) return;
    const now = new Date().toISOString();
    const followUps = initial?.followUps ?? [];
    if (followUpDate) followUps.push({ id: uid(), date: followUpDate, note: followUpNote, done: false });
    onSave({ ...form, id: initial?.id ?? uid(), followUps, createdAt: initial?.createdAt ?? now, lastTouched: now });
  };
  const handlePickTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = OUTREACH_TEMPLATES.find(t => t.id === id);
    setMessageDraft(tpl ? fillTemplate(tpl.body, form) : "");
  };
  const handleCopyMessage = async () => {
    if (!messageDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(messageDraft);
      toast.success("Message copied — paste it into your email or LinkedIn.");
    } catch {
      toast.error("Couldn't copy — select and copy the text manually.");
      return;
    }
    if (initial) {
      const tpl = OUTREACH_TEMPLATES.find(t => t.id === templateId);
      onTemplateUsed?.(initial.id, tpl?.name ?? "Custom message");
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg card p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{initial ? "Edit Contact" : "Add Contact"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Name *</label><input className="input-field w-full" placeholder="Alex Johnson" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Title</label><input className="input-field w-full" placeholder="Engineering Manager" value={form.title} onChange={e => set("title", e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Company *</label><input className="input-field w-full" placeholder="Stripe" value={form.company} onChange={e => set("company", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Email</label><input className="input-field w-full" placeholder="alex@stripe.com" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">LinkedIn URL</label><input className="input-field w-full" placeholder="linkedin.com/in/alex" value={form.linkedin ?? ""} onChange={e => set("linkedin", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Channel</label>
              <select className="input-field w-full" value={form.channel} onChange={e => set("channel", e.target.value)}>
                <option value="linkedin">LinkedIn</option><option value="email">Email</option>
                <option value="phone">Phone</option><option value="referral">Referral</option><option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <select className="input-field w-full" value={form.status} onChange={e => set("status", e.target.value as ContactStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs text-slate-400 mb-1 block">Notes</label><textarea className="input-field w-full resize-none" rows={3} placeholder="Context, mutual connections, conversation highlights…" value={form.notes} onChange={e => set("notes", e.target.value)} /></div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Outreach Message</p>
            <select className="input-field w-full mb-2" value={templateId} onChange={e => handlePickTemplate(e.target.value)}>
              <option value="">Choose a template…</option>
              {OUTREACH_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {templateId && (
              <p className="text-[11px] text-slate-500 mb-2">{OUTREACH_TEMPLATES.find(t => t.id === templateId)?.description}</p>
            )}
            <textarea
              className="input-field w-full resize-none font-mono text-xs"
              rows={6}
              placeholder="Pick a template above, or write your own message here…"
              value={messageDraft}
              onChange={e => setMessageDraft(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCopyMessage}
              disabled={!messageDraft.trim()}
              className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border text-slate-300 hover:text-white transition-colors disabled:opacity-40"
              style={{ border: "1px solid var(--border)" }}
            >
              <Copy className="w-3.5 h-3.5" /> Copy to clipboard
            </button>
            <p className="text-[10px] text-slate-600 mt-1.5">Fully editable — customize before sending manually. No message is sent automatically.</p>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-slate-400 mb-2">Add Follow-Up Reminder</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="input-field w-full" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              <input className="input-field w-full" placeholder="Follow-up note" value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-sm text-slate-400 hover:text-white transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.name || !form.company} className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-40">{initial ? "Save Changes" : "Add Contact"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Row ──────────────────────────────────────────────────────────────
function ContactRow({ contact, activityEntries, onEdit, onDelete, onStatusChange, onToggleFollowUp }: {
  contact: Contact; activityEntries: ActivityEntry[]; onEdit: () => void; onDelete: () => void;
  onStatusChange: (s: ContactStatus) => void; onToggleFollowUp: (fid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[contact.status];
  const StatusIcon = meta.icon;
  const ChanIcon = CHANNEL_ICONS[contact.channel];
  const overdue = isOverdue(contact);
  const days = daysDiff(contact.lastTouched);
  const pendingFollowUps = contact.followUps.filter(f => !f.done);
  return (
    <div className="rounded-xl border transition-all" style={{ background: "var(--bg-card)", border: overdue ? "1px solid rgba(249,115,22,0.4)" : "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 p-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.bg}`}>
          <StatusIcon className={`w-4 h-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{contact.name}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">{contact.title}</span>
            <span className="text-xs text-slate-500">@</span>
            <span className="text-xs font-medium" style={{ color: "var(--accent-bright)" }}>{contact.company}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-[10px] flex items-center gap-1 ${meta.color}`}><StatusIcon className="w-2.5 h-2.5" />{meta.label}</span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><ChanIcon className="w-2.5 h-2.5" />{contact.channel}</span>
            <span className="text-[10px] text-slate-500">{days === 0 ? "Today" : `${days}d ago`}</span>
            {overdue && <span className="text-[10px] text-orange-400 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Follow-up overdue</span>}
            {pendingFollowUps.length > 0 && !overdue && <span className="text-[10px] text-cyan-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{pendingFollowUps.length} pending</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {contact.linkedin && <a href={contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 transition-colors"><Linkedin className="w-3.5 h-3.5" /></a>}
          {contact.email && <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 transition-colors"><Mail className="w-3.5 h-3.5" /></a>}
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Update Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s} onClick={() => onStatusChange(s)} className={`text-[10px] px-2 py-1 rounded-full border transition-all font-medium ${s === contact.status ? `${STATUS_META[s].bg} ${STATUS_META[s].color}` : "border-slate-700/60 text-slate-500 hover:border-slate-500"}`}>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          {contact.notes && <div><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Notes</p><p className="text-xs text-slate-300 leading-relaxed">{contact.notes}</p></div>}
          {contact.followUps.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Follow-Ups</p>
              <div className="space-y-1.5">
                {contact.followUps.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <button onClick={() => onToggleFollowUp(f.id)}><CheckCircle2 className={`w-4 h-4 ${f.done ? "text-emerald-400" : new Date(f.date) < new Date() ? "text-orange-400" : "text-slate-600"}`} /></button>
                    <span className={`text-xs ${f.done ? "line-through text-slate-600" : "text-slate-300"}`}>{new Date(f.date).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}{f.note ? ` — ${f.note}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><History className="w-2.5 h-2.5" />Activity</p>
            <ActivityTimeline entries={activityEntries} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { applications: apps, moveApplication, authHeaders } = useAppData();
  const [activeTab, setActiveTab] = useState<"applications" | "outreach">("applications");

  // ── Applications state ──────────────────────────────────────────────────────
  const [followUpDates, setFollowUpDates] = useState<Record<string, string>>({});
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setFollowUpDates(loadFollowUpDates());
  }, []);

  // ── Activity log state (shared by applications + Outreach CRM contacts) ────
  const [activityLog, setActivityLog] = useState<Record<string, ActivityEntry[]>>({});
  const [expandedActivity, setExpandedActivity] = useState<Set<string>>(new Set());

  const addActivity = useCallback((entityType: ActivityEntry["entityType"], entityId: string, action: ActivityAction, note?: string) => {
    setActivityLog(prev => {
      const list = prev[entityId] ? [...prev[entityId]] : [];
      list.unshift({ id: uid(), entityType, entityId, action, note, at: new Date().toISOString() });
      const next = { ...prev, [entityId]: list.slice(0, MAX_ENTRIES_PER_ENTITY) };
      persistActivityLog(next);
      return next;
    });
    // Best-effort backend sync — only applications have a real Postgres-backed
    // row to attach history to (see backend/api/activity_log.py). Falls back
    // to local-only silently if the backend is unreachable or the id isn't a
    // real (backend-issued) UUID yet (e.g. an offline-fallback temp id).
    if (entityType === "application" && isRealUuid(entityId)) {
      fetch(`${API}/api/activity-log`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ application_id: entityId, action_type: action, note }),
      }).catch(() => {});
    }
  }, [authHeaders]);

  // Hydrate from localStorage once on mount.
  useEffect(() => { setActivityLog(loadActivityLog()); }, []);

  // Best-effort: merge in server-side history for real applications (works
  // across devices/sessions once a real backend is reachable; silently
  // no-ops otherwise, leaving the local-only history as-is).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/activity-log?limit=500`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const remoteEntries: ActivityEntry[] = (data.entries ?? [])
          .filter((e: { applicationId?: string }) => e.applicationId)
          .map((e: { id: string; applicationId: string; actionType: ActivityAction; note?: string; createdAt: string }) => ({
            id: e.id, entityType: "application" as const, entityId: e.applicationId,
            action: e.actionType, note: e.note, at: e.createdAt,
          }));
        if (remoteEntries.length === 0) return;
        setActivityLog(prev => {
          const next = { ...prev };
          for (const entry of remoteEntries) {
            const list = next[entry.entityId] ? [...next[entry.entityId]] : [];
            if (!list.some(x => x.id === entry.id)) list.push(entry);
            next[entry.entityId] = list;
          }
          for (const key of Object.keys(next)) {
            next[key] = [...next[key]]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .slice(0, MAX_ENTRIES_PER_ENTITY);
          }
          persistActivityLog(next);
          return next;
        });
      } catch { /* backend unreachable — local-only history stands */ }
    })();
  }, [authHeaders]);

  // Lightweight, idempotent reminder check (see backend/api/activity_log.py
  // for why this is a page-load check rather than a true background job):
  // turns any due/overdue application follow-up into a real Notification.
  useEffect(() => {
    fetch(`${API}/api/activity-log/check-followup-reminders`, { method: "POST", headers: authHeaders() }).catch(() => {});
  }, [authHeaders]);

  const toggleActivityExpand = (id: string) => {
    setExpandedActivity(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("applicationId", id); };
  const handleDrop = (e: React.DragEvent, status: ApplicationStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("applicationId");
    const app = apps.find(a => a.id === id);
    moveApplication(id, status);
    if (app && app.status !== status) {
      addActivity("application", id, "status_change", `${app.status} → ${status}`);
    }
  };
  const handleSetFollowUp = (appId: string, date: string) => {
    const updated = { ...followUpDates, [appId]: date };
    setFollowUpDates(updated); saveFollowUpDate(appId, date); setEditingFollowUp(null);
    addActivity("application", appId, "follow_up_set", `Follow-up set for ${fmtDate(date)}`);
    // Persist to the real Application row too (this is what makes the
    // backend's reminder check able to see it) — best-effort, and skipped
    // for offline-fallback temp ids that were never issued by the backend.
    if (isRealUuid(appId)) {
      fetch(`${API}/api/applications/${appId}`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ follow_up_date: date }),
      }).catch(() => {});
    }
  };
  const handleClearFollowUp = (appId: string) => {
    const updated = { ...followUpDates }; delete updated[appId];
    setFollowUpDates(updated); removeFollowUpDate(appId);
    addActivity("application", appId, "follow_up_cleared", "Follow-up cleared");
    // Note: the backend's PATCH /api/applications/{id} only *sets*
    // follow_up_date (a null payload value means "leave unchanged" there,
    // see backend/api/applications.py) — clearing a previously-persisted
    // server-side date isn't something this change can do without editing
    // that endpoint, which was out of scope here. The clear is fully honored
    // client-side (localStorage override always wins over app.followUpDate,
    // see the kanban card render below).
  };
  const overdueApps = Object.entries(followUpDates).filter(([, d]) => d < today).length;

  // ── Stage-conversion analytics ──────────────────────────────────────────────
  // Real conversion rates between adjacent pipeline stages, computed from the
  // applications already loaded on this page. Methodology: for each stage,
  // count applications currently AT that stage or further along (a simple,
  // honest proxy for "reached this stage" given we only have a status
  // snapshot, not per-application stage-transition timestamps). Rejected
  // applications are excluded — see the FUNNEL_ORDER comment above.
  const stageConversions = useMemo(() => {
    const nonRejected = apps.filter(a => a.status !== "Rejected");
    const rank = (s: ApplicationStatus) => FUNNEL_ORDER.indexOf(s);
    const reached = FUNNEL_ORDER.map((_, i) => nonRejected.filter(a => rank(a.status) >= i).length);
    return FUNNEL_ORDER.slice(0, -1).map((stage, i) => ({
      from: stage,
      to: FUNNEL_ORDER[i + 1],
      fromCount: reached[i],
      toCount: reached[i + 1],
      rate: reached[i] > 0 ? Math.round((reached[i + 1] / reached[i]) * 100) : null,
    }));
  }, [apps]);
  const rejectedCount = apps.filter(a => a.status === "Rejected").length;

  // ── Outreach state ──────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ContactStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"lastTouched" | "name" | "company">("lastTouched");

  const LS_KEY = "ji_outreach_contacts";
  useState(() => { try { const s = localStorage.getItem(LS_KEY); if (s) setContacts(JSON.parse(s)); } catch {} });
  const saveContacts = (cs: Contact[]) => { setContacts(cs); try { localStorage.setItem(LS_KEY, JSON.stringify(cs)); } catch {} };
  const addContact = (c: Contact) => {
    saveContacts([c, ...contacts]);
    setModal(null);
    addActivity("contact", c.id, "contact_status_change", `Added as ${STATUS_META[c.status].label}`);
    if (c.followUps.length > 0) {
      const fu = c.followUps[c.followUps.length - 1];
      addActivity("contact", c.id, "follow_up_set", `Follow-up set for ${fmtDate(fu.date)}${fu.note ? ` — ${fu.note}` : ""}`);
    }
  };
  const editContact = (c: Contact) => {
    const prev = contacts.find(x => x.id === c.id);
    saveContacts(contacts.map(x => x.id === c.id ? c : x));
    setModal(null); setEditing(null);
    if (prev) {
      if (prev.status !== c.status) {
        addActivity("contact", c.id, "contact_status_change", `${STATUS_META[prev.status].label} → ${STATUS_META[c.status].label}`);
      }
      if (c.notes.trim() && c.notes !== prev.notes) {
        addActivity("contact", c.id, "note_added", c.notes.length > 100 ? `${c.notes.slice(0, 100)}…` : c.notes);
      }
      if (c.followUps.length > prev.followUps.length) {
        const fu = c.followUps[c.followUps.length - 1];
        addActivity("contact", c.id, "follow_up_set", `Follow-up set for ${fmtDate(fu.date)}${fu.note ? ` — ${fu.note}` : ""}`);
      }
    }
  };
  const deleteContact = (id: string)  => { saveContacts(contacts.filter(x => x.id !== id)); };
  const changeStatus = (id: string, s: ContactStatus) => {
    const prev = contacts.find(x => x.id === id);
    saveContacts(contacts.map(x => x.id === id ? { ...x, status: s, lastTouched: new Date().toISOString() } : x));
    if (prev && prev.status !== s) {
      addActivity("contact", id, "contact_status_change", `${STATUS_META[prev.status].label} → ${STATUS_META[s].label}`);
    }
  };
  const toggleFollowUp = (cid: string, fid: string) => {
    const contact = contacts.find(c => c.id === cid);
    const fu = contact?.followUps.find(f => f.id === fid);
    saveContacts(contacts.map(x => x.id === cid ? { ...x, followUps: x.followUps.map(f => f.id === fid ? { ...f, done: !f.done } : f) } : x));
    if (fu && !fu.done) {
      addActivity("contact", cid, "follow_up_completed", fu.note ? fu.note : `Follow-up completed (${fmtDate(fu.date)})`);
    }
  };
  const handleTemplateUsed = useCallback((contactId: string, templateName: string) => {
    addActivity("contact", contactId, "outreach_logged", `${templateName} — message copied`);
  }, [addActivity]);
  const filtered = useMemo(() => {
    let cs = contacts;
    if (search) cs = cs.filter(c => `${c.name} ${c.company} ${c.title}`.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") cs = cs.filter(c => c.status === filterStatus);
    return [...cs].sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "company" ? a.company.localeCompare(b.company) : new Date(b.lastTouched).getTime() - new Date(a.lastTouched).getTime());
  }, [contacts, search, filterStatus, sortBy]);
  const pipeline = useMemo(() => { const counts: Partial<Record<ContactStatus, number>> = {}; contacts.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1; }); return counts; }, [contacts]);
  const overdueContacts = contacts.filter(isOverdue).length;

  // Real Notifications for newly due/overdue contact follow-ups. Contacts
  // have no backend row (see the ActivityEntry/ActivityLog comments above),
  // so this posts directly to the existing, already-built /api/notifications
  // endpoint (backend/api/notifications.py) — reusing that system rather
  // than inventing a parallel one. Deduped via localStorage so the same
  // follow-up doesn't re-notify on every page load/contacts change.
  useEffect(() => {
    if (contacts.length === 0) return;
    const notified = loadNotifiedFollowupKeys();
    const pending: { contact: Contact; followUp: FollowUp }[] = [];
    for (const c of contacts) {
      for (const f of c.followUps) {
        if (f.done || f.date > today) continue;
        const key = `${c.id}:${f.id}`;
        if (notified.has(key)) continue;
        pending.push({ contact: c, followUp: f });
        notified.add(key);
      }
    }
    if (pending.length === 0) return;
    persistNotifiedFollowupKeys(notified);
    (async () => {
      for (const { contact, followUp } of pending) {
        const overdue = followUp.date < today;
        const title = overdue ? "Follow-up overdue" : "Follow-up due today";
        const body = `${contact.name} @ ${contact.company}${followUp.note ? ` — ${followUp.note}` : ""}`;
        try {
          await fetch(`${API}/api/notifications`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              type: "application_followup",
              title, body,
              action_url: "/applications",
              metadata: { contact_id: contact.id, follow_up_id: followUp.id },
            }),
          });
        } catch { /* offline — still recorded locally below */ }
        addActivity("contact", contact.id, "reminder_sent", title);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, today, authHeaders]);

  const tabs = [
    { id: "applications" as const, label: "Applications", icon: KanbanSquare, badge: overdueApps > 0 ? overdueApps : null },
    { id: "outreach"     as const, label: "Outreach CRM", icon: Users,        badge: overdueContacts > 0 ? overdueContacts : null },
  ];

  return (
    <div className="flex min-h-screen bg-transparent">
      <main
        className="md:ml-64 xl:mr-72 flex-1 px-4 md:px-8 pt-20 md:pt-8 pb-4 flex flex-col"
        style={activeTab === "applications" ? { height: "100dvh", overflow: "hidden" } : {}}
      >
        {/* Header */}
        <div className="mb-5 shrink-0 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline</h1>
            <p className="text-slate-400 text-sm mt-1">Track applications and outreach in your job search pipeline.</p>
          </div>
          {activeTab === "outreach" && (
            <button onClick={() => { setEditing(null); setModal("add"); }} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm shrink-0">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-5 shrink-0" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={activeTab === id ? {
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent-bright)",
                border: "1px solid var(--border-hover)",
                boxShadow: "0 0 12px -4px var(--glow-accent)",
              } : { color: "#94a3b8", border: "1px solid transparent" }}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge !== null && badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── APPLICATIONS TAB ─────────────────────────────────────────────── */}
        {activeTab === "applications" && (
          <>
            {overdueApps > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm mb-4 shrink-0">
                <AlertCircle className="w-4 h-4" />
                <span>{overdueApps} overdue follow-up{overdueApps > 1 ? "s" : ""}</span>
              </div>
            )}

            {/* Pipeline summary: animated stat tiles + funnel chart (compact, not a takeover) */}
            {apps.length > 0 && (
              <div className="card p-4 mb-4 shrink-0 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  {[
                    { label: "Total",      value: apps.length, color: "var(--accent-bright)" },
                    { label: "Active",     value: apps.filter(a => a.status !== "Rejected").length, color: "var(--accent-secondary)" },
                    { label: "Interviews", value: apps.filter(a => a.status === "Interview").length, color: "var(--accent)" },
                    { label: "Offers",     value: apps.filter(a => a.status === "Offer").length, color: "var(--accent-bright)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <AnimatedStat value={value} className="text-2xl font-bold block" style={{ color }} />
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="w-full lg:w-64 shrink-0 lg:border-l lg:pl-4" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Pipeline Funnel
                  </p>
                  <ApplicationsFunnelChart applications={apps} />
                </div>
              </div>
            )}

            {/* Stage-conversion analytics — real rates between adjacent pipeline stages */}
            {apps.length > 0 && (
              <div className="card p-4 mb-4 shrink-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3" /> Stage Conversion
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {stageConversions.map(c => (
                    <div key={`${c.from}-${c.to}`}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400 truncate">{c.from} → {c.to}</span>
                        <span className="font-semibold text-white shrink-0 ml-1">{c.rate === null ? "—" : `${c.rate}%`}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "var(--accent)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${c.rate ?? 0}%` }}
                          transition={motionTransition("slow", "outQuint")}
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1">{c.toCount} of {c.fromCount}</p>
                    </div>
                  ))}
                </div>
                {rejectedCount > 0 && (
                  <p className="text-[10px] text-slate-600 mt-3">
                    Excludes {rejectedCount} rejected application{rejectedCount > 1 ? "s" : ""} — stage of exit isn&apos;t tracked.
                  </p>
                )}
              </div>
            )}

            <LayoutGroup id="applications-kanban">
              <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                {COLUMNS.map(col => {
                  const colApps = apps.filter(a => a.status === col.id);
                  return (
                    <div key={col.id} className="kanban-col flex flex-col" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, col.id)}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-sm font-semibold ${col.color}`}>{col.title} <span className="text-slate-500 font-normal">({colApps.length})</span></h3>
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                        <AnimatePresence mode="popLayout">
                          {colApps.map(app => {
                            const followUp = followUpDates[app.id] ?? app.followUpDate;
                            const isOverdueApp = followUp && followUp < today;
                            const isDueToday = followUp && followUp === today;
                            return (
                              <motion.div
                                key={app.id}
                                layoutId={`app-card-${app.id}`}
                                layout
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                draggable
                                onDragStartCapture={e => handleDragStart(e, app.id)}
                                className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-colors"
                                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                                <h4 className="text-sm font-semibold text-white mb-1 leading-tight hover:text-indigo-300">{app.job.title}</h4>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                                  <Building2 className="w-3.5 h-3.5" /><span className="truncate">{app.job.organization}</span>
                                </div>
                                {followUp && (
                                  <div className={`rounded px-2 py-1.5 flex items-center justify-between text-[11px] mb-2 border ${isOverdueApp ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : isDueToday ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "border-slate-700 text-slate-400"}`}>
                                    <div className="flex items-center gap-1.5">
                                      <Bell className="w-3 h-3" />
                                      {isOverdueApp ? "Overdue: " : isDueToday ? "Today: " : "Follow up: "}
                                      {new Date(followUp + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </div>
                                    <button onClick={() => handleClearFollowUp(app.id)} className="opacity-60 hover:opacity-100 transition-opacity ml-1"><BellOff className="w-3 h-3" /></button>
                                  </div>
                                )}
                                {editingFollowUp === app.id ? (
                                  <div className="mb-2 flex gap-1">
                                    <input type="date" min={today} defaultValue={followUp ?? ""} className="flex-1 border border-slate-600 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500" style={{ background: "var(--bg-input)" }}
                                      onKeyDown={e => { if (e.key === "Escape") setEditingFollowUp(null); }}
                                      onChange={e => { if (e.target.value) handleSetFollowUp(app.id, e.target.value); }} />
                                    <button onClick={() => setEditingFollowUp(null)} className="text-slate-500 hover:text-slate-300 text-[11px] px-1">✕</button>
                                  </div>
                                ) : (!followUp && col.id !== "Saved" && col.id !== "Rejected" && col.id !== "Offer" && (
                                  <button onClick={() => setEditingFollowUp(app.id)} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-400 mb-2 transition-colors">
                                    <Bell className="w-3 h-3" /> Set follow-up
                                  </button>
                                ))}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-600/50">
                                  <span className="text-[10px] text-slate-500">{col.id === "Saved" ? "Bookmarked" : `Applied ${new Date(app.dateApplied + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => toggleActivityExpand(app.id)}
                                      className="flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-white transition-colors"
                                      title="Activity history"
                                    >
                                      <History className="w-3 h-3" />
                                      {(activityLog[app.id]?.length ?? 0) > 0 && <span>{activityLog[app.id].length}</span>}
                                    </button>
                                    <Link href={`/jobs/${app.jobId}`} className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-0.5">View Job <ArrowUpRight className="w-3 h-3" /></Link>
                                  </div>
                                </div>
                                {expandedActivity.has(app.id) && (
                                  <div className="mt-2 pt-2 border-t border-slate-600/50">
                                    <ActivityTimeline entries={activityLog[app.id] ?? []} />
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {colApps.length === 0 && (
                          <div className="flex items-center justify-center h-20 text-slate-600 text-xs text-center border border-dashed border-slate-700/50 rounded-xl">Drop here</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </LayoutGroup>
          </>
        )}

        {/* ── OUTREACH TAB ─────────────────────────────────────────────────── */}
        {activeTab === "outreach" && (
          <div className="flex-1 overflow-y-auto pb-12">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Total",      value: contacts.length, color: "text-white" },
                { label: "Active",     value: contacts.filter(c => !["rejected","ghosted"].includes(c.status)).length, color: "text-cyan-400" },
                { label: "Interviews", value: (pipeline.interview ?? 0) + (pipeline.call_scheduled ?? 0), color: "text-amber-400" },
                { label: "Overdue",    value: overdueContacts, color: overdueContacts > 0 ? "text-orange-400" : "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-4 text-center">
                  <AnimatedStat value={value} className={`text-2xl font-bold block ${color}`} />
                  <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Pipeline funnel */}
            {contacts.length > 0 && (
              <div className="card p-4 mb-5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" />Pipeline</p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter(s => pipeline[s]).map(s => {
                    const meta = STATUS_META[s];
                    return (
                      <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border transition-all font-medium ${filterStatus === s ? `${meta.bg} ${meta.color}` : "border-slate-700/50 text-slate-400 hover:border-slate-500"}`}>
                        {STATUS_META[s].label}
                        <span className={`text-[10px] font-bold px-1 rounded ${filterStatus === s ? meta.color : "text-slate-500"}`}>{pipeline[s]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search + sort */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="input-field w-full pl-10" placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="input-field" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="lastTouched">Sort: Last Touched</option>
                <option value="name">Sort: Name</option>
                <option value="company">Sort: Company</option>
              </select>
              {filterStatus !== "all" && (
                <button onClick={() => setFilterStatus("all")} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border text-slate-400 hover:text-white transition-all" style={{ border: "1px solid var(--border)" }}>
                  <Filter className="w-3.5 h-3.5" /> Clear filter
                </button>
              )}
            </div>

            {/* Contact list */}
            {filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">{contacts.length === 0 ? "No contacts yet" : "No contacts match your filter"}</h3>
                <p className="text-slate-400 text-sm mb-5">{contacts.length === 0 ? "Add hiring managers, recruiters, and engineers you've reached out to." : "Try a different search or filter."}</p>
                {contacts.length === 0 && (
                  <button onClick={() => { setEditing(null); setModal("add"); }} className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
                    <Plus className="w-4 h-4" /> Add your first contact
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(c => (
                  <ContactRow key={c.id} contact={c}
                    activityEntries={activityLog[c.id] ?? []}
                    onEdit={() => { setEditing(c); setModal("edit"); }}
                    onDelete={() => deleteContact(c.id)}
                    onStatusChange={s => changeStatus(c.id, s)}
                    onToggleFollowUp={fid => toggleFollowUp(c.id, fid)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {(modal === "add" || modal === "edit") && (
          <ContactModal
            initial={modal === "edit" ? editing : null}
            onSave={modal === "edit" ? editContact : addContact}
            onClose={() => { setModal(null); setEditing(null); }}
            onTemplateUsed={handleTemplateUsed}
          />
        )}
      </main>
    </div>
  );
}
