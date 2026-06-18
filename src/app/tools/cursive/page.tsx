import { ErrorBoundary } from "@/components/shared/error-boundary"
import CursivePage from "@/features/cursive/page-content"

export default function CursiveRoute() {
  return (
    <ErrorBoundary>
      <CursivePage />
    </ErrorBoundary>
  )
}
