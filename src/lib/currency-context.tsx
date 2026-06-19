"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { CurrencyInfo } from "@/lib/currency"
import { formatAmount } from "@/lib/currency"

const STORAGE_KEY = "toolbox-currency"

interface CurrencyContextValue {
  currency: CurrencyInfo
  setCurrency: (c: CurrencyInfo) => void
  format: (amount: number, compact?: boolean) => string
  /** Format with a specific currency code (overrides context) */
  formatIn: (amount: number, code: string, compact?: boolean) => string
  loading: boolean
}

const DEFAULT: CurrencyInfo = { code: "USD", symbol: "$", country: "US" }

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT,
  setCurrency: () => {},
  format: (n) => `$${n.toFixed(2)}`,
  formatIn: (n, code) => formatAmount(n, code),
  loading: true,
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyInfo>(DEFAULT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Load from localStorage immediately (instant, no flash)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setCurrencyState(JSON.parse(stored))
        setLoading(false)
        return // Use cached, don't re-fetch
      }
    } catch { /* ignore */ }

    // 2. Detect from IP via our API route
    fetch("/api/currency")
      .then((r) => r.json())
      .then((data: CurrencyInfo) => {
        setCurrencyState(data)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      })
      .catch(() => {
        setCurrencyState(DEFAULT)
      })
      .finally(() => setLoading(false))
  }, [])

  function setCurrency(c: CurrencyInfo) {
    setCurrencyState(c)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  }

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    format: (amount, compact) => formatAmount(amount, currency.code, compact),
    formatIn: (amount, code, compact) => formatAmount(amount, code, compact),
    loading,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
