"use client"

import Link from "next/link"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export function Header() {
  const { isSignedIn } = useUser()

  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Toolbox
        </Link>
        <nav className="flex items-center gap-4">
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">Sign In</Button>
            </SignInButton>
          ) : (
            <UserButton />
          )}
        </nav>
      </div>
    </header>
  )
}
