import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b supports-backdrop-filter:backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3 flex-wrap">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Icon className={`w-5 h-5 shrink-0 ${color}`} />
        <span className="font-semibold min-w-0 truncate">{title}</span>
        <Badge variant="secondary" className="shrink-0">{badge}</Badge>
        {actions && (
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end min-w-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
