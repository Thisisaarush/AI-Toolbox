export const serverOnly = <T,>(fn: () => T): T => {
  if (typeof window !== "undefined") {
    throw new Error("This function can only be called on the server")
  }
  return fn()
}
