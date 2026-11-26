import { Link } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';
import { NovelRating } from '@/components/NovelRating';
import { useState } from 'react';
import type { NovelRecord } from '@/lib/novels';
export function NovelCover({ novel, className = '' }: { novel: NovelRecord; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`aspect-[3/4] shrink-0 overflow-hidden rounded-md bg-catalog-surface ${className}`}>
    {novel.cover_url && !failed ? <img src={novel.cover_url} alt={`${novel.title} cover`} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-3 text-catalog-muted"><BookOpen className="size-8" /></div>}
  </div>;
}
export function NovelCard({ novel, rank }: { novel: NovelRecord; rank?: number }) {
  return <Link to="/novel/$slug" params={{ slug: novel.slug }} className="group flex min-w-0 gap-4 rounded-md border border-catalog-border bg-catalog-surface p-3 transition-colors hover:border-catalog-primary">
    <NovelCover novel={novel} className="w-20" />
    <div className="min-w-0 flex-1">
      {rank !== undefined && <span className="text-xs text-catalog-primary">#{rank}</span>}
      <h2 className="line-clamp-2 font-display-font text-base group-hover:text-catalog-primary">{novel.title}</h2>
      <p className="mt-1 truncate text-xs text-catalog-muted">{novel.original_author || novel.category}</p>
      <p className="mt-2 line-clamp-2 text-xs text-catalog-muted">{novel.genres.join(' · ')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-catalog-muted"><NovelRating novel={novel} /><span>{novel.total_chapters} chapters</span><span className="capitalize">{novel.status}</span></div>
    </div>
  </Link>;
}
