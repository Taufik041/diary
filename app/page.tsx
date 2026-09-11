import { Editor } from "@/components/editor/Editor";
import { sampleSpread } from "@/lib/diary/fixtures";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <header className="flex -rotate-[0.3deg] items-baseline gap-4 px-6 pt-5 pb-1 md:px-10 md:pt-7">
        <h1 className="font-serif text-[34px] leading-none italic">Diary</h1>
        <span className="font-mono text-[11px] tracking-[.12em] text-ink-faint uppercase">
          September 2026
        </span>
      </header>
      <Editor initialPages={sampleSpread} className="min-h-0 flex-1" />
    </main>
  );
}
