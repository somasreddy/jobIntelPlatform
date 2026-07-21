"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock3 } from "lucide-react";

type TimelineEvent = {
  id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  occurred_at?: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ApplicationTimeline({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState(false);
  const persisted = !applicationId.startsWith("saved-") && !applicationId.startsWith("applied-");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || events || !persisted) return;
    setError(false);
    const token = localStorage.getItem("ji_token");
    try {
      const response = await fetch(`${API}/api/applications/${applicationId}/timeline`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("timeline unavailable");
      const payload = await response.json();
      setEvents(payload.events || []);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="mt-2">
      <button onClick={toggle} className="text-[10px] text-slate-500 hover:text-cyan-300 flex items-center gap-1">
        <Clock3 className="w-3 h-3" /> Activity
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 border-l border-white/10 pl-2 space-y-2">
          {!persisted && <p className="text-[10px] text-slate-500">Timeline will sync when this local record is persisted.</p>}
          {persisted && events === null && !error && <p className="text-[10px] text-slate-500">Loading activity?</p>}
          {error && <p className="text-[10px] text-amber-400">Timeline unavailable; pipeline state is unchanged.</p>}
          {events?.length === 0 && <p className="text-[10px] text-slate-500">No recorded events yet.</p>}
          {events?.map((event) => (
            <div key={event.id}>
              <p className="text-[10px] text-slate-300">{event.event_type.replaceAll("_", " ")}</p>
              <p className="text-[9px] text-slate-600">
                {event.from_status && event.to_status ? `${event.from_status} ? ${event.to_status} ? ` : ""}
                {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : "Pending timestamp"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
