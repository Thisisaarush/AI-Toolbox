"use client"

import Link from "next/link"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Settings, Search } from "lucide-react"

export function Header({ sticky = true }: { sticky?: boolean }) {
  const { isSignedIn } = useUser()

  return (
    <header className={`border-b ${sticky ? "sticky top-0" : ""} bg-background/95 backdrop-blur z-50`}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="text-base font-bold tracking-tight shrink-0">
          Toolbox
        </Link>

        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="hidden sm:flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors max-w-xs flex-1"
          aria-label="Search tools"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">Search tools...</span>
        </button>

        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="sm:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Search tools"
        >
          <Search className="w-4 h-4" />
        </button>

        <nav className="flex items-center gap-1 shrink-0">
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

          {!isSignedIn ? (
            <SignInButton mode="modal">
              <Button variant="outline" size="sm" className="ml-1 shrink-0">
                Sign In
              </Button>
            </SignInButton>
          ) : (
            <div className="ml-1 shrink-0">
              <UserButton />
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
