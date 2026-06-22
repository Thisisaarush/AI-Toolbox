"use client"

import Link from "next/link"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Settings } from "lucide-react"

export function Header({ sticky = true }: { sticky?: boolean }) {
  const { isSignedIn } = useUser()

  return (
    <header className={`border-b ${sticky ? "sticky top-0" : ""} bg-background/95 backdrop-blur z-50`}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-tight shrink-0">
          Toolbox
        </Link>

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
