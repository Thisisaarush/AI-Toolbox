import { ErrorBoundary } from "@/components/shared/error-boundary"
import { DreamScapeContent } from "@/features/dream-scape/page-content"

export default function DreamScapePage() {
  return (
    <ErrorBoundary>
      <DreamScapeContent />
    </ErrorBoundary>
  )
}
