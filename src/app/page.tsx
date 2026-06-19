import { Header } from "@/components/shared/header"
import { ToolsSection } from "@/components/home/tools-section"
import { HeroCategories } from "@/components/home/hero-categories"
import { CATEGORY_META, ALL_TOOL_COUNT } from "@/lib/tools-meta"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header sticky={false} />

      <main className="flex-1 h-screen overflow-y-auto snap-y snap-mandatory">
        {/* Hero — full viewport, snaps to top */}
        <section className="relative h-screen snap-start shrink-0 bg-white dark:bg-[#0a0a0a] overflow-hidden border-b border-border">
          {/* Grid — light mode */}
          <div
            className="absolute inset-0 opacity-[0.04] dark:hidden"
            style={{
              backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
              backgroundSize: "72px 72px",
            }}
          />
          {/* Grid — dark mode */}
          <div
            className="absolute inset-0 hidden dark:block opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "72px 72px",
            }}
          />

          <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Tools that slot into your workflow
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05] text-black dark:text-white">
              Every tool you need.{" "}
              <span className="text-black/25 dark:text-white/30">Nothing you don&rsquo;t.</span>
            </h1>

            <p className="text-base md:text-lg text-black/50 dark:text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
              Purpose-built tools for developers, builders, and makers. Subscriptions, invoices, fitness, documents, learning, and more.
            </p>

            <p className="text-sm font-medium text-black/30 dark:text-white/30 mb-8 tracking-wider">
              {ALL_TOOL_COUNT}+ tools across {CATEGORY_META.length} categories
            </p>

            <HeroCategories />

            {/* Scroll-down indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/40 animate-bounce">
              <span className="text-[10px] font-medium tracking-wider uppercase">Scroll</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-180">
                <path d="M8 3v10M8 13L4 9M8 13l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </section>

        {/* Tools + footer — snaps below hero, scrolls naturally */}
        <div className="min-h-screen snap-start bg-background">
          <ToolsSection />

          <footer className="border-t py-8 bg-background">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Toolbox</span>
                <span className="text-muted-foreground/40">·</span>
                <span>Tools for everyone who builds</span>
              </div>
              <span className="text-xs">{ALL_TOOL_COUNT} tools · More coming</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
