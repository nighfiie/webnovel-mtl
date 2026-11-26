import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CatalogShell, CatalogError, CatalogNotFound, EmptyCatalog } from '@/components/catalog/CatalogShell';
import { NovelCard } from '@/components/catalog/NovelCard';
import { BrowseFilters } from '@/components/catalog/BrowseFilters';
import { publicCatalogOptions, catalogHead } from '@/lib/public-catalog';
import { BROWSE_SORTS, filterBrowseNovels, selectedLabels, validateBrowseSearch, type BrowseSearch, type BrowseSort } from '@/lib/browse-filters';
export const Route = createFileRoute('/browse')({
  validateSearch: validateBrowseSearch,
  head: () => catalogHead('Browse Novels', 'Search ReadNovel by title or author, include or exclude genres and tags, and filter by length, rating, update date and original language.'),
  staticData: { importedDocument: { html: { lang: 'en', 'data-theme': 'moonlit-pavilion' } } },
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(publicCatalogOptions); },
  errorComponent: CatalogError, notFoundComponent: CatalogNotFound,
  component: BrowsePage,
});
function BrowsePage() {
  const { data: { novels } } = useSuspenseQuery(publicCatalogOptions);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/browse' });
  const [drawer, setDrawer] = useState(false);
  const results = filterBrowseNovels(novels, search);
  const pages = Math.max(1, Math.ceil(results.length / 12));
  const page = Math.min(search.page || 1, pages);
  function update(patch: BrowseSearch) { void navigate({ search: prev => validateBrowseSearch({ ...prev, ...patch, page: 1 }), replace: true }); }
  const active: { key: string; label: string; remove: () => void }[] = [];
  for (const key of ['genre', 'exclude', 'tag', 'excludeTag'] as const) for (const label of selectedLabels(search[key])) active.push({ key: `${key}:${label}`, label: `${key === 'exclude' || key === 'excludeTag' ? '−' : '+'} ${label}`, remove: () => update({ [key]: selectedLabels(search[key]).filter(l => l !== label).join(',') }) });
  for (const key of ['status', 'language', 'origin'] as const) if (search[key]) active.push({ key, label: String(search[key]), remove: () => update({ [key]: '' }) });
  for (const key of ['min', 'rating', 'days'] as const) if (search[key]) active.push({ key, label: key === 'min' ? `${search.min}+ chapters` : key === 'rating' ? `${search.rating}+ stars` : `Updated in ${search.days} days`, remove: () => update({ [key]: 0 }) });
  if (search.q) active.push({ key: 'q', label: `Search: ${search.q}`, remove: () => update({ q: '' }) });
  const panel = <BrowseFilters novels={novels} search={search} update={update} />;
  return <CatalogShell>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display-font text-2xl">Browse Novels</h1><Button variant="outline" disabled={!results.length} onClick={() => { const n = results[Math.floor(Math.random() * results.length)]; if (n) void navigate({ to: '/novel/$slug', params: { slug: n.slug } }); }}><Shuffle />Surprise Me</Button></div>
    <div className="mt-6 flex gap-2"><input aria-label="Search catalog" type="search" placeholder="Search title, original title or author…" value={search.q || ''} onChange={e => update({ q: e.target.value })} className="h-11 min-w-0 flex-1 rounded-md border border-catalog-border bg-catalog-background px-3" /><Button className="lg:hidden" variant="outline" aria-label={`Open filters (${active.length})`} onClick={() => setDrawer(true)}><SlidersHorizontal /><span className="hidden sm:inline">Filters</span>{active.length || ''}</Button></div>
    <Sheet open={drawer} onOpenChange={setDrawer}><SheetContent side="left" className="catalog-shell w-[90%] max-w-sm overflow-y-auto border-catalog-border bg-catalog-background text-catalog-foreground"><SheetTitle className="text-catalog-foreground">Filters</SheetTitle><SheetDescription className="mb-5 text-catalog-muted">{results.length} novels</SheetDescription>{panel}<Button className="mt-6 w-full" onClick={() => setDrawer(false)}>Show {results.length} novels</Button></SheetContent></Sheet>
    <div className="mt-6 grid min-w-0 gap-7 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside aria-label="Novel filters" className="hidden min-w-0 border-r border-catalog-border pr-5 lg:block"><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-medium">Filters</h2><Button variant="ghost" size="sm" onClick={() => void navigate({ search: {}, replace: true })}>Reset all</Button></div>{panel}</aside>
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-catalog-muted">{results.length} {results.length === 1 ? 'novel' : 'novels'}</p><div className="flex items-center gap-2"><select aria-label="Sort" value={search.sort || 'recent'} onChange={e => update({ sort: e.target.value as BrowseSort })} className="h-9 max-w-48 rounded-md border border-catalog-border bg-catalog-background px-2 text-sm">{Object.entries(BROWSE_SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button variant="outline" size="icon" title="Reverse sort" aria-label="Toggle sort direction" onClick={() => update({ ascending: !search.ascending })}>{search.ascending ? <ArrowUp /> : <ArrowDown />}</Button></div></div>
        {active.length > 0 && <div className="mb-5 flex flex-wrap gap-2" aria-label="Active filters">{active.map(f => <Button key={f.key} variant="outline" size="sm" className="h-auto min-h-8 whitespace-normal text-left text-xs" aria-label={`Remove ${f.label}`} onClick={f.remove}>{f.label}<X className="size-3 shrink-0" /></Button>)}<Button variant="ghost" size="sm" onClick={() => void navigate({ search: {}, replace: true })}>Reset all</Button></div>}
        {!results.length ? <EmptyCatalog message="No novels match your filters." /> : <div className="grid gap-3 md:grid-cols-2">{results.slice((page - 1) * 12, page * 12).map(n => <NovelCard key={n.id} novel={n} />)}</div>}
        {pages > 1 && <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 1} onClick={() => void navigate({ search: prev => ({ ...prev, page: page - 1 }) })}>Previous</Button><span className="text-sm">{page} / {pages}</span><Button variant="outline" disabled={page === pages} onClick={() => void navigate({ search: prev => ({ ...prev, page: page + 1 }) })}>Next</Button></nav>}
      </section>
    </div>
  </CatalogShell>;
}
