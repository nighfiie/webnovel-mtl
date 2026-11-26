import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CatalogShell, CatalogError, CatalogNotFound, EmptyCatalog } from '@/components/catalog/CatalogShell';
import { NovelCover } from '@/components/catalog/NovelCard';
import { publicCatalogOptions, catalogLabels, catalogHead } from '@/lib/public-catalog';
export const Route=createFileRoute('/show_all_/categories')({
  head:()=>catalogHead('Novel Genres','Explore every genre in the ReadNovel library, including Fantasy, Romance, Wuxia, and Xianxia.'),
  staticData:{importedDocument:{html:{lang:'en','data-theme':'moonlit-pavilion'}}},
  loader:async({context})=>{await context.queryClient.ensureQueryData(publicCatalogOptions);},
  errorComponent:CatalogError,notFoundComponent:CatalogNotFound,component:GenresPage,
});
function GenresPage(){
  const {data:{novels}}=useSuspenseQuery(publicCatalogOptions);const genres=catalogLabels(novels);
  return <CatalogShell><h1 className="font-display-font text-2xl">Novel Genres</h1>{!genres.length?<EmptyCatalog />:<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{genres.map(g=>{const n=novels.find(n=>n.category===g.label||n.genres.includes(g.label));return <Link key={g.label} to="/browse" search={{genre:g.label}} className="flex min-w-0 items-center gap-4 rounded-md border border-catalog-border bg-catalog-surface p-4 hover:border-catalog-primary">{n&&<NovelCover novel={n} className="w-16" />}<div className="min-w-0"><h2 className="break-words font-display-font text-xl">{g.label}</h2><p className="mt-2 text-sm text-catalog-muted">{g.count} {g.count===1?'novel':'novels'}</p></div></Link>;})}</div>}</CatalogShell>;
}
