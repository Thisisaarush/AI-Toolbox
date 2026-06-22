"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import type { Plan } from "@/lib/subscription"

type SubscriptionData = {
  plan: Plan
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  loading: boolean
}

const defaultData: SubscriptionData = {
  plan: "free",
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  loading: true,
}

const SubscriptionContext = createContext<{
  subscription: SubscriptionData
  refresh: () => Promise<void>
}>({ subscription: defaultData, refresh: async () => {} })

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionData>(defaultData)
  const { getToken } = useAuth()

  const fetchSubscription = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      const token = await getToken()
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("/api/razorpay/subscription", { headers })
      if (!res.ok) {
        setSubscription((p) => ({ ...p, loading: false }))
        return
      }
      const data = await res.json()
      setSubscription({
        plan: data.plan ?? "free",
        status: data.status ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        loading: false,
      })
    } catch {
      setSubscription((p) => ({ ...p, loading: false }))
    }
  }, [getToken])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  return (
    <SubscriptionContext.Provider value={{ subscription, refresh: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
