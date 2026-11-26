import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { BookOpen, TrendingUp } from 'lucide-react';
import { NovelRating } from '@/components/NovelRating';
import { Button } from '@/components/ui/button';
import { CatalogShell, CatalogError, CatalogNotFound, EmptyCatalog } from '@/components/catalog/CatalogShell';
import { NovelCard, NovelCover } from '@/components/catalog/NovelCard';
import { ChapterFeed } from '@/components/catalog/ChapterFeed';
import { publicCatalogOptions, rankNovels, catalogLabels, catalogHead } from '@/lib/public-catalog';

export const Route = createFileRoute('/')({
  head: () => catalogHead('ReadNovel — Wuxia, Light & Korean Novels', 'Discover web novels, explore genres, and read the latest chapters on ReadNovel.'),
  staticData: { importedDocument: { html: { lang: 'en', 'data-theme': 'moonlit-pavilion' } } },
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(publicCatalogOptions); },
  errorComponent: CatalogError, notFoundComponent: CatalogNotFound,
  component: HomePage,
});
function HomePage() {
  const { data: { novels, chapters } } = useSuspenseQuery(publicCatalogOptions);
  const trending = rankNovels(novels, 'weekly');
  const featured = trending[0];
  const firstChapter = featured ? [...chapters].filter(c=>c.novel_id===featured.id).sort((a,b)=>a.number-b.number)[0] : undefined;
  return <CatalogShell>
    <h1 className="font-display-font text-2xl">ReadNovel</h1>
    <p className="mt-2 text-sm text-catalog-muted">Wuxia, Light and Korean Novels</p>
    {!featured ? <EmptyCatalog message="New novels are coming soon." /> : <section className="mt-7 grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-6 py-3 sm:flex-row sm:items-center">
        <Link to="/novel/$slug" params={{slug:featured.slug}} className="shrink-0"><NovelCover novel={featured} className="w-36 sm:w-44" /></Link>
        <div className="min-w-0"><div className="flex items-center gap-2 text-xs uppercase text-catalog-gold"><TrendingUp className="size-4" />Trending now</div>
          <h2 className="mt-3 font-display-font text-3xl">{featured.title}</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-catalog-muted"><span className="capitalize">{featured.status}</span>{featured.genres.map(g=><Link key={g} to="/browse" search={{genre:g}} className="hover:text-catalog-primary">{g}</Link>)}</div>
          <p className="mt-4 line-clamp-4 font-body-font text-sm leading-7 text-catalog-muted">{featured.synopsis}</p>
          <div className="mt-4 flex gap-4 text-xs text-catalog-muted"><NovelRating novel={featured} showCount /><span className="flex gap-1"><BookOpen className="size-3" />{featured.total_chapters} chapters</span></div>
          <div className="mt-4 flex gap-2">{firstChapter && <Button asChild><Link to="/novel/$slug/chapter/$number" params={{slug:featured.slug,number:String(firstChapter.number)}}>Start reading</Link></Button>}<Button asChild variant="outline"><Link to="/novel/$slug" params={{slug:featured.slug}}>Details</Link></Button></div>
        </div>
      </div>
      <div className="grid gap-2">{trending.slice(1,5).map((n,i)=><NovelCard key={n.id} novel={n} rank={i+2} />)}</div>
    </section>}
    <div className="mt-6 flex flex-wrap gap-2">{catalogLabels(novels).slice(0,16).map(g=><Button key={g.label} asChild variant="outline" size="sm"><Link to="/browse" search={{genre:g.label}}>{g.label}<span className="text-catalog-muted">{g.count}</span></Link></Button>)}</div>
    <section className="mt-10 grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-2 [&>div]:min-w-0">
      <div><div className="flex items-center justify-between border-b border-catalog-border pb-3"><h2 className="font-display-font text-xl">Latest Updates</h2><Button asChild variant="link" size="sm"><Link to="/updates">View all</Link></Button></div><ChapterFeed chapters={chapters.slice(0,8)} novels={novels} /></div>
      <div><div className="flex items-center justify-between border-b border-catalog-border pb-3"><h2 className="font-display-font text-xl">Popular Novels</h2><Button asChild variant="link" size="sm"><Link to="/rankings">View all</Link></Button></div><div className="mt-4 grid gap-3">{rankNovels(novels,'popular').slice(0,4).map(n=><NovelCard key={n.id} novel={n} />)}</div></div>
    </section>
    <section className="mt-10"><h2 className="border-b border-catalog-border pb-3 font-display-font text-xl">Recently Added</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{[...novels].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,6).map(n=><NovelCard key={n.id} novel={n} />)}</div></section>
  </CatalogShell>;
}
