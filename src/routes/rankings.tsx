import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CatalogShell, CatalogError, CatalogNotFound, EmptyCatalog } from '@/components/catalog/CatalogShell';
import { NovelCard } from '@/components/catalog/NovelCard';
import { NovelRating } from '@/components/NovelRating';
import { Button } from '@/components/ui/button';
import { publicCatalogOptions, rankNovels, catalogHead, type RankingMetric } from '@/lib/public-catalog';

export const Route=createFileRoute('/rankings')({
  validateSearch: (s:Record<string,unknown>):{metric?:RankingMetric}=> ['weekly','popular','rating'].includes(String(s['metric']))?{metric:s['metric'] as RankingMetric}:{},
  head:()=>catalogHead('Novel Rankings','Explore the most-read and highest-rated novels on ReadNovel.'),
  staticData:{importedDocument:{html:{lang:'en','data-theme':'moonlit-pavilion'}}},
  loader:async({context})=>{await context.queryClient.ensureQueryData(publicCatalogOptions);},
  errorComponent:CatalogError,notFoundComponent:CatalogNotFound,
  component:RankingsPage,
});
function RankingsPage(){
  const {data:{novels}}=useSuspenseQuery(publicCatalogOptions);
  const metric=Route.useSearch().metric||'weekly';
  const navigate=useNavigate({from:'/rankings'});
  return <CatalogShell><h1 className="font-display-font text-2xl">Novel Rankings</h1><div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Rank by">{([{id:'weekly',label:'This week'},{id:'popular',label:'All time'},{id:'rating',label:'Highest rated'}] as const).map(m=><Button key={m.id} variant={metric===m.id?'default':'outline'} aria-pressed={metric===m.id} onClick={()=>void navigate({search:{metric:m.id}})}>{m.label}</Button>)}</div>
    {!novels.length?<EmptyCatalog />:<ol className="mt-6 grid list-none gap-3 md:grid-cols-2">{rankNovels(novels,metric).map((n,i)=><li key={n.id}><NovelCard novel={n} rank={i+1} /><p className="mt-1 px-3 text-right text-xs text-catalog-muted">{metric==='rating'?<NovelRating novel={n} showCount />:`${(metric==='weekly'?n.weekly_views:n.view_count).toLocaleString()} views`}</p></li>)}</ol>}
  </CatalogShell>;
}
