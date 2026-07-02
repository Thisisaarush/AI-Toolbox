"use client"

import Link from "next/link"
import { Shield, Braces, Palette, CreditCard, Rocket } from "lucide-react"

type FloatingIcon = {
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  bgColor: string
  style: React.CSSProperties
}

// A small, curated spread of tool icons that float around the hero's edges,
// avoiding the centered headline/subhead column. Purely a decorative,
// bonus navigation shortcut — hidden from screen readers/keyboard nav
// since every tool remains reachable via the main tools grid below.
// Kept intentionally minimal (5 max) so the hero doesn't feel cluttered.
const floatingIcons: FloatingIcon[] = [
  { icon: Shield, href: "/tools/dependguard", color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950", style: { top: "12%", left: "7%", "--float-delay": "0s", "--float-duration": "6.5s" } as React.CSSProperties },
  { icon: Braces, href: "/tools/json-studio", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", style: { top: "16%", right: "8%", "--float-delay": "0.8s", "--float-duration": "5.8s" } as React.CSSProperties },
  { icon: Rocket, href: "/tools/launch-pad", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", style: { top: "45%", left: "4%", "--float-delay": "1.4s", "--float-duration": "7s" } as React.CSSProperties },
  { icon: Palette, href: "/tools/color-studio", color: "text-fuchsia-500", bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950", style: { bottom: "18%", left: "10%", "--float-delay": "0.4s", "--float-duration": "6.2s" } as React.CSSProperties },
  { icon: CreditCard, href: "/tools/sub-sheriff", color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950", style: { bottom: "20%", right: "11%", "--float-delay": "1s", "--float-duration": "6.8s" } as React.CSSProperties },
]

export function HeroFloatingIcons() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none" aria-hidden="true">
      {floatingIcons.map((item, i) => (
        <Link
          key={i}
          href={item.href}
          tabIndex={-1}
          className={`floating-icon pointer-events-auto absolute w-12 h-12 rounded-xl ${item.bgColor} border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-center cursor-pointer`}
          style={item.style}
        >
          <item.icon className={`w-5 h-5 ${item.color}`} />
        </Link>
      ))}
    </div>
  )
}
