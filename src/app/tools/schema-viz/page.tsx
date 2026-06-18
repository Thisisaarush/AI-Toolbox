import { ErrorBoundary } from "@/components/shared/error-boundary"
import { SchemaVizContent } from "@/features/schema-viz/page-content"

export default function SchemaVizPage() {
  return (
    <ErrorBoundary>
      <SchemaVizContent />
    </ErrorBoundary>
  )
}
