import { ErrorBoundary } from "@/components/shared/error-boundary"
import { VibeCheckContent } from "@/features/vibe-check/page-content"

export default function VibeCheckPage() {
  return (
    <ErrorBoundary>
      <VibeCheckContent />
    </ErrorBoundary>
  )
}
