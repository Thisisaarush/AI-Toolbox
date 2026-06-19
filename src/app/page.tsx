import { Header } from "@/components/shared/header"
import { ToolsSection } from "@/components/home/tools-section"
import { CATEGORY_META, ALL_TOOL_COUNT } from "@/lib/tools-meta"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-white dark:bg-[#0a0a0a] overflow-hidden border-b border-border">
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

          <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-40 text-center">
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

            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORY_META.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50"
                >
                  <span className={`w-2 h-2 rounded-full ${cat.legendColor}`} />
                  {cat.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tool grid with interactive category filter */}
        <ToolsSection />
      </main>

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
  )
}
