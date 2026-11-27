import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BUILTIN_PROFILES, PROFILE_STORAGE_KEY, validateProfile, type SelectorProfile } from "@/lib/scraper-profiles";

export function useSelectorProfiles() {
  const [profiles, setProfiles] = useState<SelectorProfile[]>(BUILTIN_PROFILES);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
      if (Array.isArray(saved)) setProfiles(saved.map(p => validateProfile(p as SelectorProfile)));
    } catch { /* ignore invalid saved profiles */ }
  }, []);
  const save = (next: SelectorProfile[]) => { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next)); setProfiles(next); };
  return { profiles, save };
}
const EMPTY: SelectorProfile = { domain: "", title: "", body: "", nextChapter: "", nextPage: "", remove: "" };
export function SelectorProfiles({ profiles, save, disabled }: ReturnType<typeof useSelectorProfiles> & { disabled: boolean }) {
  const [draft, setDraft] = useState<SelectorProfile>(EMPTY);
  return <details className="rounded-md border border-admin-border p-3 text-admin-foreground">
    <summary className="cursor-pointer text-sm font-medium">Site selector profiles</summary>
    <div className="mt-3 space-y-3">
      <select aria-label="Saved site profile" disabled={disabled} className="w-full rounded-md border border-admin-border bg-admin-background p-2 text-xs" onChange={e => setDraft(profiles.find(p => p.domain === e.target.value) || EMPTY)} value={profiles.some(p => p.domain === draft.domain) ? draft.domain : ""}>
        <option value="">New profile</option>{profiles.map(p => <option key={p.domain} value={p.domain}>{p.domain}</option>)}
      </select>
      {([['domain','Domain'],['title','Chapter title selector'],['body','Chapter body selector'],['nextChapter','Next chapter selector'],['nextPage','Next page selector (same chapter)'],['remove','Remove selectors']] as const).map(([key,label]) => <label key={key} className="block text-xs">{label}<Input disabled={disabled} value={draft[key]} onChange={e => setDraft(p => ({...p,[key]:e.target.value}))} className="mt-1 bg-admin-background text-admin-foreground" /></label>)}
      <div className="flex gap-2">
        <Button size="sm" disabled={disabled} onClick={() => { try { const p = validateProfile(draft); save([...profiles.filter(x => x.domain !== p.domain), p]); setDraft(p); toast.success("Profile saved in this browser"); } catch (err) { toast.error(err instanceof Error ? err.message : "Invalid selector"); } }}><Save className="h-4 w-4"/>Save profile</Button>
        <Button size="icon" variant="outline" disabled={disabled || !profiles.some(p => p.domain === draft.domain)} title="Delete profile" onClick={() => { save(profiles.filter(p => p.domain !== draft.domain)); setDraft(EMPTY); }}><Trash2 className="h-4 w-4"/></Button>
      </div>
    </div>
  </details>;
}
