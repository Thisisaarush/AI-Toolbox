"use client"

import Link from "next/link"
import {
  Shield, Braces, Globe, Palette, FilePlus, CreditCard,
  TrendingUp, Rocket, Dumbbell, MessageCircle,
} from "lucide-react"

type FloatingIcon = {
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  bgColor: string
  style: React.CSSProperties
}

// A curated spread of tool icons that float around the hero's edges,
// avoiding the centered headline/subhead column. Purely a decorative,
// bonus navigation shortcut — hidden from screen readers/keyboard nav
// since every tool remains reachable via the main tools grid below.
const floatingIcons: FloatingIcon[] = [
  { icon: Shield, href: "/tools/dependguard", color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950", style: { top: "10%", left: "6%", "--float-delay": "0s", "--float-duration": "6.5s" } as React.CSSProperties },
  { icon: Braces, href: "/tools/json-studio", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", style: { top: "16%", right: "8%", "--float-delay": "0.8s", "--float-duration": "5.8s" } as React.CSSProperties },
  { icon: Globe, href: "/tools/dns-desk", color: "text-sky-500", bgColor: "bg-sky-50 dark:bg-sky-950", style: { top: "40%", left: "4%", "--float-delay": "1.6s", "--float-duration": "7s" } as React.CSSProperties },
  { icon: Palette, href: "/tools/color-studio", color: "text-fuchsia-500", bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950", style: { top: "44%", right: "5%", "--float-delay": "0.4s", "--float-duration": "6.2s" } as React.CSSProperties },
  { icon: FilePlus, href: "/tools/form-builder", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", style: { top: "68%", left: "9%", "--float-delay": "1.2s", "--float-duration": "5.5s" } as React.CSSProperties },
  { icon: CreditCard, href: "/tools/sub-sheriff", color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950", style: { top: "72%", right: "10%", "--float-delay": "2s", "--float-duration": "6.8s" } as React.CSSProperties },
  { icon: TrendingUp, href: "/tools/net-worth", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950", style: { top: "9%", left: "32%", "--float-delay": "0.6s", "--float-duration": "6s" } as React.CSSProperties },
  { icon: Rocket, href: "/tools/launch-pad", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", style: { top: "11%", right: "30%", "--float-delay": "1.8s", "--float-duration": "6.4s" } as React.CSSProperties },
  { icon: Dumbbell, href: "/tools/workout-log", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", style: { bottom: "16%", left: "22%", "--float-delay": "1s", "--float-duration": "5.6s" } as React.CSSProperties },
  { icon: MessageCircle, href: "/tools/chat-anyone", color: "text-pink-500", bgColor: "bg-pink-50 dark:bg-pink-950", style: { bottom: "16%", right: "24%", "--float-delay": "0.2s", "--float-duration": "7.2s" } as React.CSSProperties },
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
