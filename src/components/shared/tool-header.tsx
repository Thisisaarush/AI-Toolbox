import Link from "next/link"
import { ArrowLeft, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import type { LucideIcon } from "lucide-react"

type ToolHeaderProps = {
  title: string
  icon: LucideIcon
  color: string
  badge: string
  actions?: React.ReactNode
}

export function ToolHeader({ title, icon: Icon, color, badge, actions }: ToolHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
        <span className="font-semibold text-sm min-w-0 truncate flex-1">{title}</span>
        <Badge variant="secondary" className="shrink-0 text-xs hidden sm:inline-flex">{badge}</Badge>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <ThemeToggle />
          <Link href="/settings" className="shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
          {actions && <div className="flex items-center gap-2 ml-1">{actions}</div>}
        </div>
      </div>
    </header>
  )
}
