import { useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { catalogLabels } from '@/lib/public-catalog';
import { selectedLabels, type BrowseSearch } from '@/lib/browse-filters';
import type { NovelRecord } from '@/lib/novels';
export function BrowseFilters({ novels, search, update }: { novels: NovelRecord[]; search: BrowseSearch; update: (patch: BrowseSearch) => void }) {
  const [query, setQuery] = useState('');
  const [allGenres, setAllGenres] = useState(false);
  const [allTags, setAllTags] = useState(false);
  const genres = catalogLabels(novels);
  const counts = new Map<string, number>();
  novels.forEach(n => new Set(n.tags).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  const tags = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const origins = [...new Set(novels.map(n => n.original_language).filter((l): l is string => Boolean(l)))].sort();
  function cycle(label: string, tag: boolean) {
    const inc = tag ? 'tag' : 'genre', exc = tag ? 'excludeTag' : 'exclude';
    const included = selectedLabels(search[inc]), excluded = selectedLabels(search[exc]);
    const state = included.includes(label) ? 'include' : excluded.includes(label) ? 'exclude' : 'any';
    update({ [inc]: [...included.filter(l => l !== label), ...(state === 'any' ? [label] : [])].join(','), [exc]: [...excluded.filter(l => l !== label), ...(state === 'include' ? [label] : [])].join(',') });
  }
  function list(items: { label: string; count: number }[], tag: boolean, showAll: boolean) {
    const found = items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()));
    return <div className="mt-2 grid grid-cols-2 gap-1.5">{found.filter((i, index) => showAll || Boolean(query) || index < (tag ? 10 : 8) || selectedLabels(search[tag ? 'tag' : 'genre']).includes(i.label) || selectedLabels(search[tag ? 'excludeTag' : 'exclude']).includes(i.label)).map(i => {
      const state = selectedLabels(search[tag ? 'tag' : 'genre']).includes(i.label) ? 'include' : selectedLabels(search[tag ? 'excludeTag' : 'exclude']).includes(i.label) ? 'exclude' : 'any';
      return <Button key={i.label} variant="outline" size="sm" aria-label={`${i.label}: ${state}`} aria-pressed={state !== 'any'} onClick={() => cycle(i.label, tag)} className={`h-auto min-h-9 justify-start whitespace-normal px-2 text-left text-xs ${state === 'include' ? 'border-catalog-primary bg-catalog-primary/10 text-catalog-primary' : state === 'exclude' ? 'border-catalog-destructive bg-catalog-destructive/10 text-catalog-destructive' : ''}`}>{state === 'include' ? <Plus className="size-3 shrink-0" /> : state === 'exclude' ? <Minus className="size-3 shrink-0" /> : null}<span className="min-w-0 flex-1 break-words">{i.label}</span><span className="text-catalog-muted">{i.count}</span></Button>;
    })}{!found.length && <p className="col-span-2 py-2 text-xs text-catalog-muted">No matches.</p>}</div>;
  }
  const inputClass = 'h-9 w-full rounded-md border border-catalog-border bg-catalog-background px-2 text-sm text-catalog-foreground';
  return <div className="space-y-6">
    <section><h3 className="mb-2 text-xs font-semibold uppercase">Find a tag or genre</h3><div className="relative"><Search className="absolute left-2.5 top-3 size-4 text-catalog-muted" /><input aria-label="Search tags and genres" placeholder="Search tags and genres" value={query} onChange={e => setQuery(e.target.value)} className="h-10 w-full rounded-md border border-catalog-border bg-catalog-background pl-9 pr-2 text-sm" /></div></section>
    <section><h3 className="mb-2 text-xs font-semibold uppercase">Status</h3><div role="group" aria-label="Status" className="grid grid-cols-2 gap-1">{[['', 'Any'], ['ongoing', 'Ongoing'], ['completed', 'Completed'], ['hiatus', 'Hiatus']].map(([value, label]) => <Button key={label} variant={(search.status || '') === value ? 'default' : 'outline'} size="sm" aria-pressed={(search.status || '') === value} onClick={() => update({ status: value || '' })}>{label}<span className="text-xs opacity-70">{novels.filter(n => !value || n.status === value).length}</span></Button>)}</div></section>
    <section><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase">Genres</h3><Button variant="ghost" size="sm" className="h-7 text-xs" aria-expanded={allGenres} onClick={() => setAllGenres(!allGenres)}>{allGenres ? 'Show less' : `Show all ${genres.length}`}</Button></div>{list(genres, false, allGenres)}</section>
    <section><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase">Popular tags</h3><Button variant="ghost" size="sm" className="h-7 text-xs" aria-expanded={allTags} onClick={() => setAllTags(!allTags)}>{allTags ? 'Show less' : `Show all ${tags.length}`}</Button></div>{list(tags, true, allTags)}</section>
    <section><h3 className="mb-2 text-xs font-semibold uppercase">Length</h3><p className="mb-2 text-xs text-catalog-muted">Chapters, at least</p><div className="flex flex-wrap gap-1">{[0, 100, 300, 500, 1000].map(min => <Button key={min} size="sm" variant={(search.min || 0) === min ? 'default' : 'outline'} aria-pressed={(search.min || 0) === min} onClick={() => update({ min })}>{min ? `${min}+` : 'Any'}</Button>)}</div><label className="mt-3 grid gap-1 text-xs text-catalog-muted">Minimum chapters<input aria-label="Minimum chapters" type="number" min="0" value={search.min || 0} onChange={e => update({ min: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} /></label></section>
    <details open={Boolean(search.rating || search.days || search.origin || search.language)}><summary className="cursor-pointer text-sm font-medium">More filters<span className="mt-1 block text-xs font-normal text-catalog-muted">Rating, last update, original language</span></summary><div className="mt-4 space-y-4">
      <label className="grid gap-1 text-xs text-catalog-muted">Minimum rating<select aria-label="Minimum rating" value={search.rating || 0} onChange={e => update({ rating: Number(e.target.value) })} className={inputClass}>{[0, 3, 3.5, 4, 4.5].map(n => <option key={n} value={n}>{n ? `${n}+ stars` : 'Any rating'}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-catalog-muted">Last update<select aria-label="Last update" value={search.days || 0} onChange={e => update({ days: Number(e.target.value) })} className={inputClass}>{[[0, 'Any time'], [1, 'Last 24 hours'], [7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-catalog-muted">Original language<select aria-label="Original language" value={search.origin || ''} onChange={e => update({ origin: e.target.value })} className={inputClass}><option value="">Any language</option>{origins.map(l => <option key={l}>{l}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-catalog-muted">Languages<select aria-label="Languages" value={search.language || ''} onChange={e => update({ language: e.target.value })} className={inputClass}><option value="">All novels</option><option value="dual">Dual language</option><option value="single">Single language</option></select></label>
    </div></details>
  </div>;
}