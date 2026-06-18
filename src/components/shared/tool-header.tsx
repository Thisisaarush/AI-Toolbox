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
    <header className="border-b">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="font-semibold">{title}</span>
        <Badge variant="secondary">{badge}</Badge>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
    </header>
  )
}
