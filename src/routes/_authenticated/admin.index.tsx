import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Edit3, ExternalLink, LogOut, Plus, ShieldAlert, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SiteImportDialog } from "@/components/admin/SiteImportDialog";
import { TagEditor } from "@/components/TagEditor";
import { normalizeTags } from "@/lib/tags";
import { NOVEL_GENRES, NOVEL_STATUSES, slugifyTitle, type NovelRecord } from "@/lib/novels";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — ReadNovel" },
      { name: "description", content: "Manage novels, chapters, imports, and translations." },
      { property: "og:title", content: "Admin Dashboard — ReadNovel" },
      { property: "og:description", content: "Manage novels, chapters, imports, and translations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  component: AdminNovelsPage,
});

interface NovelFormState {
  id?: string;
  title: string;
  slug: string;
  original_title: string;
  original_author: string;
  category: string;
  genres: string[];
  tags: string[];
  status: string;
  language_mode: string;
  original_language: string;
  translated_language: string;
  cover_url: string;
  synopsis: string;
}

const EMPTY_FORM: NovelFormState = {
  title: "",
  slug: "",
  original_title: "",
  original_author: "",
  category: "Xianxia",
  genres: ["Xianxia"],
  tags: [],
  status: "ongoing",
  language_mode: "dual",
  original_language: "Chinese",
  translated_language: "English",
  cover_url: "",
  synopsis: "",
};

function AdminNovelsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [novelPage, setNovelPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NovelFormState>(EMPTY_FORM);
  const [tagDraft, setTagDraft] = useState("");
  const [siteImportOpen, setSiteImportOpen] = useState(false);

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const { data: novels = [], isLoading: novelsLoading } = useQuery({
    queryKey: ["admin-novels"],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("novels")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NovelRecord[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: NovelFormState) => {
      const slug = payload.slug.trim() || slugifyTitle(payload.title);
      const record = {
        title: payload.title.trim(),
        slug,
        original_title: payload.original_title.trim() || null,
        original_author: payload.original_author.trim() || null,
        category: payload.category,
        genres: payload.genres,
        tags: normalizeTags(payload.tags),
        status: payload.status,
        language_mode: payload.language_mode,
        original_language: payload.original_language.trim() || "Chinese",
        translated_language: payload.translated_language.trim() || "English",
        cover_url: payload.cover_url.trim() || null,
        synopsis: payload.synopsis.trim() || null,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        const { error } = await supabase.from("novels").update(record).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("novels").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Novel updated" : "Novel created");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-novels"] });
      queryClient.invalidateQueries({ queryKey: ["catalog", "public"] });
      queryClient.invalidateQueries({ queryKey: ["novel"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save novel"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("novels").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted selected novel(s)");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-novels"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<NovelRecord> }) => {
      const { error } = await supabase
        .from("novels")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bulk update applied");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-novels"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk update failed"),
  });

  const { edit: editSlug } = Route.useSearch();
  useEffect(() => {
    if (!editSlug || !novels.length) return;
    const target = novels.find((n) => n.slug === editSlug);
    if (target) openEdit(target);
    navigate({ to: "/admin", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlug, novels]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
  };

  const openEdit = (n: NovelRecord) => {
    setForm({
      id: n.id,
      title: n.title,
      slug: n.slug,
      original_title: n.original_title ?? "",
      original_author: n.original_author ?? "",
      category: n.category,
      genres: n.genres ?? [],
      tags: n.tags ?? [],
      status: n.status,
      language_mode: n.language_mode,
      original_language: n.original_language ?? "Chinese",
      translated_language: n.translated_language ?? "English",
      cover_url: n.cover_url ?? "",
      synopsis: n.synopsis ?? "",
    });
    setModalOpen(true);
    setTagDraft("");
  };

  if (roleLoading) {
    return <div className="min-h-screen bg-[#0c1017] text-slate-300 flex items-center justify-center">Checking permissions...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0c1017] text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-slate-800 bg-[#121822] p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-4 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your account ({user.email}) does not have the admin role yet.
          </p>
          <p className="mt-3 rounded-lg bg-slate-900 p-2 font-mono text-xs text-slate-300 break-all">
            User ID: {user.id}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
              Go Home
            </Link>
            <Button variant="outline" onClick={handleSignOut} className="border-slate-700 text-slate-200">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = novels.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.original_title ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const NOVELS_PER_PAGE = 50;
  const novelPages = Math.max(1, Math.ceil(filtered.length / NOVELS_PER_PAGE));
  const curPage = Math.min(novelPage, novelPages - 1);
  const visibleNovels = filtered.slice(curPage * NOVELS_PER_PAGE, (curPage + 1) * NOVELS_PER_PAGE);
  const allSelected = visibleNovels.length > 0 && visibleNovels.every((n) => selectedIds.includes(n.id));

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <header className="border-b border-slate-800 bg-[#121822]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-blue-400">ReadNovel</Link>
            <span className="text-sm text-slate-400">/ Admin Novels</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-300 hover:text-white gap-1.5">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Novels ({novels.length})</h1>
            <p className="text-sm text-slate-400">Add, edit, bulk-update, or manage chapters for your novels.</p>
          </div>
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSiteImportOpen(true)} className="border-slate-700 text-slate-200 gap-1.5">
            <Upload className="h-4 w-4" /> Site Import
          </Button>
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setTagDraft("");
              setModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Novel
          </Button>
          </div>
        </div>
        <SiteImportDialog open={siteImportOpen} onOpenChange={setSiteImportOpen} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Input
            value={search}
            onChange={(e) => (setSearch(e.target.value), setNovelPage(0))}
            placeholder="Search novels by title..."
            className="max-w-xs bg-slate-900 border-slate-700 text-white"
          />

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs">
              <span className="font-medium text-blue-200">{selectedIds.length} selected</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 text-xs"
                onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, patch: { status: "completed" } })}
              >
                Mark Completed
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 text-xs"
                onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, patch: { status: "ongoing" } })}
              >
                Mark Ongoing
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 text-xs"
                onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, patch: { language_mode: "dual" } })}
              >
                Set Dual Lang
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  if (window.confirm(`Delete ${selectedIds.length} selected novel(s) and all their chapters?`)) {
                    deleteMutation.mutate(selectedIds);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-[#121822]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? visibleNovels.map((n) => n.id) : [])}
                  />
                </th>
                <th className="p-3">Novel</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Chapters</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {novelsLoading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading novels...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No novels found.</td></tr>
              ) : (
                visibleNovels.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-900/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id),
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-white">{n.title}</div>
                      {n.original_title && <div className="text-xs text-slate-400">{n.original_title}</div>}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">
                        {n.language_mode}
                      </span>
                    </td>
                    <td className="p-3 capitalize text-slate-300">{n.status}</td>
                    <td className="p-3 tabular-nums text-slate-300">{n.total_chapters}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to="/admin/novels/$slug/chapters"
                          params={{ slug: n.slug }}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
                        >
                          <BookOpen className="h-3.5 w-3.5" /> Chapters
                        </Link>
                        <Link
                          to="/novel/$slug"
                          params={{ slug: n.slug }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="View public page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(n)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Edit novel"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete "${n.title}" and all its chapters?`)) {
                              deleteMutation.mutate([n.id]);
                            }
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-950 hover:text-red-400"
                          title="Delete novel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {novelPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
            <button type="button" disabled={curPage === 0} onClick={() => setNovelPage(curPage - 1)} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Prev</button>
            <span>Page {curPage + 1} of {novelPages} · {filtered.length} novels</span>
            <button type="button" disabled={curPage >= novelPages - 1} onClick={() => setNovelPage(curPage + 1)} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        )}
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#121822] border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Novel" : "Add Novel"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) {
                toast.error("Title is required");
                return;
              }
              saveMutation.mutate({ ...form, tags: normalizeTags([...form.tags, tagDraft]) });
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      title: e.target.value,
                      slug: f.id ? f.slug : slugifyTitle(e.target.value),
                    }))
                  }
                  className="mt-1 bg-slate-900 border-slate-700"
                  required
                />
              </div>
              <div>
                <Label>URL Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="mt-1 bg-slate-900 border-slate-700"
                  required
                />
              </div>
              <div>
                <Label>Original Title</Label>
                <Input
                  value={form.original_title}
                  onChange={(e) => setForm((f) => ({ ...f, original_title: e.target.value }))}
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
              <div>
                <Label>Original Author</Label>
                <Input
                  value={form.original_author}
                  onChange={(e) => setForm((f) => ({ ...f, original_author: e.target.value }))}
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {NOVEL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Language Mode</Label>
                <select
                  value={form.language_mode}
                  onChange={(e) => setForm((f) => ({ ...f, language_mode: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <option value="dual">Dual Language (Original + Translated)</option>
                  <option value="single">Single Language</option>
                </select>
              </div>
              <div>
                <Label>Primary Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {NOVEL_GENRES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Cover Image URL</Label>
                <Input
                  value={form.cover_url}
                  onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
            </div>

            <div>
              <Label>Genres</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {NOVEL_GENRES.map((g) => {
                  const active = form.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          genres: active ? f.genres.filter((x) => x !== g) : [...f.genres, g],
                        }))
                      }
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-blue-500 bg-blue-600/20 text-blue-200"
                          : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="novel-tags">Tags</Label>
              <TagEditor tags={form.tags} draft={tagDraft} onDraftChange={setTagDraft} onChange={tags => setForm(f => ({ ...f, tags }))} suggestions={normalizeTags([...novels.flatMap(n => n.tags), "Cultivation", "Overpowered Protagonist", "System", "Reincarnation", "Weak to Strong", "Fast Paced", "Swordsmanship", "Alchemy"])} />
            </div>

            <div>
              <Label>Synopsis</Label>
              <Textarea
                value={form.synopsis}
                onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
                rows={4}
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-slate-700">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-500 text-white">
                {saveMutation.isPending ? "Saving..." : "Save Novel"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}