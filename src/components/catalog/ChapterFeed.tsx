import { Link } from '@tanstack/react-router';
import type { NovelRecord } from '@/lib/novels';
import { NovelCover } from './NovelCard';
import { EmptyCatalog } from './CatalogShell';
export interface ChapterSummary { id: string; novel_id: string; number: number; title: string; created_at: string; updated_at: string }
export function ChapterFeed({ chapters, novels }: { chapters: ChapterSummary[]; novels: NovelRecord[] }) {
  const lookup = new Map(novels.map(n=>[n.id,n]));
  if (!chapters.length) return <EmptyCatalog message="No chapter updates yet." />;
  return <div className="divide-y divide-catalog-border">{chapters.map(c => {
    const n=lookup.get(c.novel_id); if (!n) return null;
    return <div key={c.id} className="flex items-center gap-3 py-4">
      <Link to="/novel/$slug" params={{slug:n.slug}} aria-label={n.title}><NovelCover novel={n} className="w-10" /></Link>
      <div className="min-w-0 flex-1"><Link to="/novel/$slug" params={{slug:n.slug}} className="block truncate text-sm hover:text-catalog-primary">{n.title}</Link><Link to="/novel/$slug/chapter/$number" params={{slug:n.slug,number:String(c.number)}} className="mt-1 block truncate text-xs text-catalog-primary">Chapter {c.number} — {c.title}</Link></div>
      <time dateTime={c.created_at} className="shrink-0 text-xs text-catalog-muted">{c.created_at.slice(0,10)}</time>
    </div>;
  })}</div>;
}
