import { Link, useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Menu, Palette, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionUser } from '@/hooks/use-session-user';
import capturedCSS from '@/styles/catalog-theme.css?raw';

const nav = [
  { to: '/', label: 'Home' }, { to: '/browse', label: 'Browse' },
  { to: '/show_all/categories', label: 'Genres' }, { to: '/rankings', label: 'Rankings' },
  { to: '/updates', label: 'Updates' }, { to: '/library', label: 'My Library' },
] as const;
const themes = ['moonlit-pavilion', 'jade-night', 'classic-light', 'rice-paper', 'morning-mist', 'midnight-ink'];
export function CatalogShell({ children }: { children: ReactNode }) {
  const user = useSessionUser();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState('moonlit-pavilion');
  const [themeOpen, setThemeOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wuxia-theme');
      if (saved && themes.includes(saved)) { setTheme(saved); document.documentElement.setAttribute('data-theme', saved); }
    } catch { /* storage unavailable */ }
  }, []);
  function pickTheme(value: string) {
    setTheme(value); document.documentElement.setAttribute('data-theme', value);
    try { localStorage.setItem('wuxia-theme', value); } catch { /* storage unavailable */ }
  }
  return <>
    <style>{capturedCSS}</style>
    <div className="catalog-shell min-h-screen bg-catalog-background text-catalog-foreground">
      <header className="sticky top-0 z-40 border-b border-catalog-border bg-catalog-background">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="mr-3 flex items-center gap-2 font-display-font text-xl"><BookOpen className="size-6 text-catalog-primary" />ReadNovel</Link>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-5 xl:flex">
            {nav.map(n => <Link key={n.to} to={n.to} className="text-sm text-catalog-muted hover:text-catalog-foreground" activeProps={{ className: 'text-catalog-foreground underline decoration-catalog-primary underline-offset-8' }} activeOptions={{ exact: true }}>{n.label}</Link>)}
          </nav>
          <form role="search" className="relative ml-auto hidden w-52 sm:block" onSubmit={e => { e.preventDefault(); void navigate({ to: '/browse', search: { q: query } }); }}>
            <Search className="absolute left-2.5 top-2.5 size-4 text-catalog-muted" />
            <input aria-label="Search novels" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search novels…" className="h-9 w-full rounded-md border border-catalog-border bg-catalog-background pl-8 pr-2 text-sm" />
          </form>
          <Button variant="ghost" size="icon" aria-label="Choose theme" onClick={() => setThemeOpen(!themeOpen)}><Palette /></Button>
          <Button asChild size="sm"><Link to={user ? '/library' : '/auth'}>{user ? 'My Library' : 'Sign in'}</Link></Button>
          <Button variant="ghost" size="icon" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(!menu)} className="xl:hidden"><Menu /></Button>
          {themeOpen && <div className="w-full border-t border-catalog-border py-3"><label className="flex items-center gap-3 text-sm">Theme<select aria-label="Theme" value={theme} onChange={e => pickTheme(e.target.value)} className="rounded-md border border-catalog-border bg-catalog-background p-2">{themes.map(t => <option key={t} value={t}>{t.replaceAll('-', ' ')}</option>)}</select></label></div>}
          {menu && <nav aria-label="Mobile" className="flex w-full flex-wrap gap-3 border-t border-catalog-border pt-3">{nav.map(n => <Button key={n.to} asChild variant="ghost" size="sm"><Link to={n.to}>{n.label}</Link></Button>)}<form className="w-full" onSubmit={e => {e.preventDefault(); void navigate({to:'/browse',search:{q:query}});}}><input aria-label="Mobile search novels" placeholder="Search novels…" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-md border border-catalog-border bg-catalog-background p-2" /></form></nav>}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto mt-10 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-catalog-border px-4 py-6 text-sm text-catalog-muted"><span>ReadNovel</span><Link to="/browse">Browse novels</Link><Link to="/library">My Library</Link>{user && <Link to="/admin">Admin Studio</Link>}</footer>
    </div>
  </>;
}
export function CatalogError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const client = useQueryClient();
  return <CatalogShell><div role="alert" className="py-16 text-center"><h1 className="text-xl">The catalog couldn’t load</h1><Button className="mt-4" onClick={async () => { await client.resetQueries({ queryKey: ['catalog', 'public'] }); await router.invalidate(); reset(); }}><RefreshCw />Try again</Button></div></CatalogShell>;
}
export function CatalogNotFound() { return <CatalogShell><h1 className="py-16 text-center text-xl">Page not found</h1></CatalogShell>; }
export function EmptyCatalog({ message = 'No novels found.' }: { message?: string }) { return <p className="py-12 text-center text-catalog-muted">{message}</p>; }
