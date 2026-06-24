"use client"

import { useEffect, useRef } from "react"

export function useHashNav<T extends string>(
  view: T,
  setView: (v: T) => void,
  validViews: readonly T[],
) {
  const initialized = useRef(false)

  useEffect(() => {
    const hash = window.location.hash.replace("#", "")
    if (!initialized.current && hash && (validViews as readonly string[]).includes(hash)) {
      setView(hash as T)
    }
    initialized.current = true
  }, [])

  useEffect(() => {
    history.pushState(null, "", `#${view}`)
  }, [view])

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#", "")
      if (hash && hash !== view && (validViews as readonly string[]).includes(hash)) {
        setView(hash as T)
      }
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [view, setView])
}
