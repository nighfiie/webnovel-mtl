import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobLogEntry } from "@/lib/job-log";

export function JobLog({ entries }: { entries: JobLogEntry[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = 0; }, [entries]);
  return <div ref={box} role="log" aria-label="Chapter activity log" className="h-36 overflow-y-auto rounded-md border border-admin-border bg-admin-background p-2 text-xs">
    {entries.length === 0 ? <p className="text-admin-muted">No activity yet.</p> : entries.map(e => <div key={e.id} className="border-b border-admin-border py-1.5 break-words">
      <span className={e.status === "error" ? "text-admin-destructive" : e.status === "success" ? "text-admin-primary" : "text-admin-muted"}>{e.status === "error" ? "Error · " : e.status === "success" ? "Saved · " : ""}</span>{e.message}
    </div>)}
  </div>;
}
export function JobActivity({ title, active, progress, entries, onStop, onDismiss }: { title: string; active: boolean; progress: string | null; entries: JobLogEntry[]; onStop: () => void; onDismiss: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return <section aria-label={`${title} activity`} className="rounded-md border border-admin-border bg-admin-surface p-3 text-admin-foreground">
    <div className="flex items-center gap-2">
      <strong className="flex-1 text-sm">{title}</strong>
      {active && <Button variant="outline" size="icon" title={`Stop ${title.toLowerCase()}`} onClick={onStop}><Square className="h-3 w-3"/></Button>}
      <Button variant="ghost" size="icon" title={collapsed ? "Expand log" : "Collapse log"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</Button>
      {!active && <Button variant="ghost" size="icon" title="Dismiss activity" onClick={onDismiss}><X className="h-4 w-4"/></Button>}
    </div>
    <p role="status" className="my-2 text-xs break-words text-admin-muted">{progress || "Finished"}</p>
    {!collapsed && <JobLog entries={entries}/>}
  </section>;
}
