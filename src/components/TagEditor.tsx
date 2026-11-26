import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeTags } from '@/lib/tags';
export function TagEditor({ tags, draft, onDraftChange, onChange, suggestions }: { tags: string[]; draft: string; onDraftChange: (value: string) => void; onChange: (tags: string[]) => void; suggestions: string[] }) {
  function add() { onChange(normalizeTags([...tags, draft])); onDraftChange(''); }
  return <div className="space-y-2"><div className="flex flex-wrap gap-1.5">{tags.map(tag => <Button key={tag} type="button" variant="outline" size="sm" onClick={() => onChange(tags.filter(t => t !== tag))} aria-label={`Remove tag ${tag}`}>{tag}<X className="size-3" /></Button>)}</div>
    <div className="flex gap-2"><Input id="novel-tags" aria-label="Tags" placeholder="Add tags…" value={draft} onChange={e => onDraftChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} /><Button type="button" variant="outline" size="icon" aria-label="Add tag" disabled={!draft.trim()} onClick={add}><Plus /></Button></div>
    <div className="flex flex-wrap gap-1">{suggestions.filter(t => !tags.some(tag => tag.toLowerCase() === t.toLowerCase())).slice(0, 10).map(t => <Button key={t} type="button" variant="ghost" size="sm" onClick={() => onChange(normalizeTags([...tags, t]))}><Plus className="size-3" />{t}</Button>)}</div>
  </div>;
}