import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CatalogShell, CatalogError, CatalogNotFound } from '@/components/catalog/CatalogShell';
import { ChapterFeed } from '@/components/catalog/ChapterFeed';
import { Button } from '@/components/ui/button';
import { publicCatalogOptions, catalogLabels, catalogHead } from '@/lib/public-catalog';
export const Route=createFileRoute('/updates')({
  validateSearch:(s:Record<string,unknown>):{q?:string;genre?:string;page?:number}=>({...(typeof s['q']==='string'?{q:s['q']}:{}),...(typeof s['genre']==='string'?{genre:s['genre']}:{}),...(Number(s['page'])>0?{page:Math.floor(Number(s['page']))}:{})}),
  head:()=>catalogHead('Latest Chapter Updates','Read the newest chapters from your favorite ReadNovel novels.'),
  staticData:{importedDocument:{html:{lang:'en','data-theme':'moonlit-pavilion'}}},
  loader:async({context})=>{await context.queryClient.ensureQueryData(publicCatalogOptions);},
  errorComponent:CatalogError,notFoundComponent:CatalogNotFound,component:UpdatesPage,
});
function UpdatesPage(){
  const {data:{novels,chapters}}=useSuspenseQuery(publicCatalogOptions);
  const search=Route.useSearch(); const navigate=useNavigate({from:'/updates'});
  const matching=new Set(novels.filter(n=>(!search.q||n.title.toLowerCase().includes(search.q.toLowerCase()))&&(!search.genre||n.category===search.genre||n.genres.includes(search.genre))).map(n=>n.id));
  const results=chapters.filter(c=>matching.has(c.novel_id)); const pages=Math.max(1,Math.ceil(results.length/20));const page=Math.min(search.page||1,pages);
  return <CatalogShell><h1 className="font-display-font text-2xl">Latest Updates</h1><div className="mt-6 flex flex-wrap gap-3"><input aria-label="Search updates" placeholder="Search novels…" value={search.q||''} onChange={e=>void navigate({search:prev=>({...prev,q:e.target.value,page:1}),replace:true})} className="h-10 min-w-0 flex-1 rounded-md border border-catalog-border bg-catalog-background px-3" /><select aria-label="Update genre" value={search.genre||''} onChange={e=>void navigate({search:prev=>({...prev,genre:e.target.value,page:1})})} className="h-10 rounded-md border border-catalog-border bg-catalog-background px-3"><option value="">All genres</option>{catalogLabels(novels).map(g=><option key={g.label} value={g.label}>{g.label}</option>)}</select></div><div className="mt-5 border-t border-catalog-border"><ChapterFeed novels={novels} chapters={results.slice((page-1)*20,page*20)} /></div>{pages>1&&<nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-4"><Button variant="outline" disabled={page===1} onClick={()=>void navigate({search:prev=>({...prev,page:page-1})})}>Previous</Button><span>{page} / {pages}</span><Button variant="outline" disabled={page===pages} onClick={()=>void navigate({search:prev=>({...prev,page:page+1})})}>Next</Button></nav>}</CatalogShell>;
}
