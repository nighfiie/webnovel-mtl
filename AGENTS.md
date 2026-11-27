<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- AI translation runs through the `translateAiFn` server function (admin-only); built-in AI uses `@lovable.dev/ai-gateway`, BYOK provider keys stay in the admin's browser and are proxied per request — never store them in the database without the planned key vault.
- Auto-crawl loops client-side in the chapter manager, using pure helpers in `src/lib/crawl-utils.ts` (tested) for next-link detection and pacing — keeps each server call short for the Worker runtime.
- Public discovery pages share `publicCatalogOptions` with safe public projections via a publishable server client; this keeps Home, Browse, Rankings, Updates, and Genres consistent without exposing reader data.
- Discovery search, filters, pagination, and ranking modes live in validated URL search parameters so refreshes and shared links preserve the selected view.
- New discovery UI adapts the imported HSL theme channels through catalog semantic tokens and uses shared catalog components to preserve the migrated appearance.
- Chapter URL imports, crawls, and editor fetches share language-aware placement helpers; write only detected columns so importing one language never clears the other, and require an override for uncertain text.
- Novel tag edits use shared normalization and invalidate the public catalog so saved metadata appears in discovery filters.
- Browse filter validation and matching live in a pure shared module; genre and tag namespaces stay separate to avoid accidental matches.
- Novel rating and review count are database-maintained review aggregates, not defaults or client-side averages of a paginated review list; refresh catalog and detail queries after review changes.
- Site-wide CSV migration (novels then chapters) runs client-side as admin via `SiteImportDialog`, with pure matching/dedupe helpers in `src/lib/migration-csv.ts` (tested); old novel ids are remapped to this site's ids so chapters land on the right novel.
- CSV novel mapping generates deterministic slugs when exports omit them, preserving supplied IDs and slugs so retries remain deduplicated and chapter links survive migration.
- Global and per-novel CSV imports share the delimiter-aware parser so old database exports and chapter-manager exports retain quoted multiline content consistently.
- Chinese-original chapter imports split paragraphs by CJK ideograph density (pure helpers in src/lib/chapter-language.ts), not n-gram detection, so short MTL lines never abort imports.
- Chapter navigation shares a metadata-only query and tested numeric range helpers; all complete chapter reads use range batching (smaller pages for admin full text) to avoid API row caps without bloating reader payloads.
- Domain selector profiles are browser-persisted and validated by the scraper; HTML extraction uses a shared pure CSS-selector parser so fallback and Firecrawl follow identical rules.
- Continuation stitching runs client-side with one server request per page and explicit next-page selectors, same-origin/loop/page guards; never infer continuation from a next-chapter link.
- Import and translation activity uses shared newest-first logs and floating panels; logs survive completion until dismissed so failed chapter lengths remain inspectable.
