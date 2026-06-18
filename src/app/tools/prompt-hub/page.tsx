import { ErrorBoundary } from "@/components/shared/error-boundary"
import { PromptHubContent } from "@/features/prompt-hub/page-content"

export default function PromptHubPage() {
  return (
    <ErrorBoundary>
      <PromptHubContent />
    </ErrorBoundary>
  )
}
