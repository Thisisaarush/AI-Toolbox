import { ErrorBoundary } from "@/components/shared/error-boundary"
import { CommitCraftContent } from "@/features/commit-craft/page-content"

export default function CommitCraftPage() {
  return (
    <ErrorBoundary>
      <CommitCraftContent />
    </ErrorBoundary>
  )
}
