import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chapterRangeStart, chapterRanges, chaptersInRange, CHAPTER_RANGE_SIZE, type ChapterSummary } from "@/lib/chapter-navigation";

function RangeSelect({ ranges, value, onChange }: { ranges: number[]; value: number; onChange: (value: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(value) => onChange(Number(value))}>
      <SelectTrigger aria-label="Chapter range" className="w-36 shrink-0 bg-background text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background text-foreground">
        {ranges.map((start) => <SelectItem className="focus:bg-primary/20 focus:text-foreground" key={start} value={String(start)}>{start}–{start + CHAPTER_RANGE_SIZE - 1}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function NovelChapterList({ chapters, slug }: { chapters: ChapterSummary[]; slug: string }) {
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState<number | null>(null);
  const [order, setOrder] = useState("oldest");
  const [jump, setJump] = useState("");
  const [jumpError, setJumpError] = useState("");
  const navigate = useNavigate();
  const query = search.trim().toLowerCase();
  const matching = chapters.filter((chapter) => !query || chapter.title.toLowerCase().includes(query) || String(chapter.number).includes(query));
  const ranges = chapterRanges(matching);
  if (order === "newest") ranges.reverse();
  const activeRange = selectedRange !== null && ranges.includes(selectedRange) ? selectedRange : ranges[0] ?? 1;
  const visible = chaptersInRange(matching, activeRange).sort((a, b) => order === "newest" ? b.number - a.number : a.number - b.number);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
          <Input aria-label="Search chapters" placeholder="Search chapters" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedRange(null); }} className="pl-9" />
        </div>
        {ranges.length > 0 && <RangeSelect ranges={ranges} value={activeRange} onChange={setSelectedRange} />}
        <Select value={order} onValueChange={(value) => { setOrder(value); setSelectedRange(null); }}>
          <SelectTrigger aria-label="Chapter order" className="w-36 bg-background text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            <SelectItem className="focus:bg-primary/20 focus:text-foreground" value="oldest">Oldest first</SelectItem>
            <SelectItem className="focus:bg-primary/20 focus:text-foreground" value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>
        <form className="flex items-center gap-1" onSubmit={(event) => {
          event.preventDefault();
          const target = chapters.find((chapter) => chapter.number === Number(jump));
          if (!jump.trim() || !target) { setJumpError("That chapter is not available."); return; }
          setJumpError("");
          void navigate({ to: "/novel/$slug/chapter/$number", params: { slug, number: String(target.number) } });
        }}>
          <Input aria-label="Jump to chapter number" type="number" step="any" placeholder="Chapter #" value={jump} onChange={(event) => { setJump(event.target.value); setJumpError(""); }} className="w-28" />
          <Button type="submit" variant="outline" size="icon" aria-label="Go to chapter" title="Go to chapter"><ArrowRight /></Button>
        </form>
      </div>
      {jumpError && <p role="alert" className="text-sm text-destructive">{jumpError}</p>}
      <p className="text-xs text-muted-foreground">{visible.length} of {matching.length} {query ? "matching " : ""}chapters</p>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">No matching chapters.</p> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((chapter) => (
            <Button asChild variant="outline" key={chapter.id} className="h-auto min-h-12 min-w-0 justify-start px-3 py-3">
              <Link to="/novel/$slug/chapter/$number" params={{ slug, number: String(chapter.number) }} title={`Ch. ${chapter.number}: ${chapter.title}`}>
                <span className="truncate">Ch. {chapter.number}: {chapter.title}</span>
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReaderChapterNavigation({ chapters, slug, currentNumber }: { chapters: ChapterSummary[]; slug: string; currentNumber: number }) {
  const [range, setRange] = useState(chapterRangeStart(currentNumber));
  const navigate = useNavigate();
  const ranges = chapterRanges(chapters);
  if (ranges.length === 0) return null;
  const activeRange = ranges.includes(range) ? range : ranges[0] ?? 1;
  const visible = chaptersInRange(chapters, activeRange);
  const selected = visible.some((chapter) => chapter.number === currentNumber) ? String(currentNumber) : "";
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <RangeSelect ranges={ranges} value={activeRange} onChange={setRange} />
      <Select value={selected} onValueChange={(number) => { void navigate({ to: "/novel/$slug/chapter/$number", params: { slug, number } }); }}>
        <SelectTrigger aria-label="Jump to chapter" className="w-44 min-w-0 flex-1 bg-background text-foreground sm:flex-none"><SelectValue placeholder="Choose chapter" /></SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-2rem)] bg-background text-foreground">
          {visible.map((chapter) => <SelectItem className="focus:bg-primary/20 focus:text-foreground" key={chapter.id} value={String(chapter.number)}>Ch. {chapter.number}: {chapter.title}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}