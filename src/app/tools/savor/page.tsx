import { ErrorBoundary } from "@/components/shared/error-boundary"
import SavorPage from "@/features/savor/page-content"

export default function SavorRoute() {
  return (
    <ErrorBoundary>
      <SavorPage />
    </ErrorBoundary>
  )
}
