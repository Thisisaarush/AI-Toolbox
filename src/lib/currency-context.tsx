"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { CurrencyInfo } from "@/lib/currency"
import { formatAmount } from "@/lib/currency"

const STORAGE_KEY = "toolbox-currency"

interface CurrencyContextValue {
  currency: CurrencyInfo
  setCurrency: (c: CurrencyInfo) => void
  format: (amount: number, compact?: boolean) => string
  formatIn: (amount: number, code: string, compact?: boolean) => string
  loading: boolean
  vpnLikely: boolean
}

const DEFAULT: CurrencyInfo = { code: "USD", symbol: "$", country: "US" }

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT,
  setCurrency: () => {},
  format: (n) => `$${n.toFixed(2)}`,
  formatIn: (n, code) => formatAmount(n, code),
  loading: true,
  vpnLikely: false,
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyInfo>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [vpnLikely, setVpnLikely] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setCurrencyState(parsed)
        setVpnLikely(parsed.vpnLikely ?? false)
        setLoading(false)
        return
      }
    } catch {}

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const lang = navigator.language

    fetch(`/api/currency?tz=${encodeURIComponent(tz)}&lang=${encodeURIComponent(lang)}`)
      .then((r) => r.json())
      .then((data: CurrencyInfo) => {
        setCurrencyState(data)
        setVpnLikely(data.vpnLikely ?? false)
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
    vpnLikely,
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
