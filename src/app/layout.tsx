import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "next-themes"
import { CurrencyProvider } from "@/lib/currency-context"
import { SubscriptionProvider } from "@/components/shared/subscription-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
})

export const metadata: Metadata = {
  title: "Toolbox — Tools for developers who ship",
  description: "A growing collection of focused tools for developers and solo builders. Subscriptions, invoices, OG images, launch copy, idea validation, changelogs, DNS, env secrets, fitness, documents, and more.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Toolbox — Tools for developers who ship",
    description: "Focused tools for developers and solo builders. Each one slots into something you already do.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ? "https://clerk.accounts.dev" : "https://clerk.toolbox.app"} />
          <script src="https://accounts.google.com/gsi/client" />
        </head>
        <body className="min-h-full flex flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            storageKey="toolbox-theme"
            disableTransitionOnChange
          >
            <CurrencyProvider>
              <SubscriptionProvider>
                <TooltipProvider>
                  {children}
                  <Toaster position="bottom-right" richColors />
                </TooltipProvider>
              </SubscriptionProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
