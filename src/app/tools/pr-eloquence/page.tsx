import { ErrorBoundary } from "@/components/shared/error-boundary"
import { PrEloquenceContent } from "@/features/pr-eloquence/page-content"

export default function PrEloquencePage() {
  return (
    <ErrorBoundary>
      <PrEloquenceContent />
    </ErrorBoundary>
  )
}
