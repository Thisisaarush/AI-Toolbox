import { ErrorBoundary } from "@/components/shared/error-boundary"
import { CurlToTypeContent } from "@/features/curl-to-type/page-content"

export default function CurlToTypePage() {
  return (
    <ErrorBoundary>
      <CurlToTypeContent />
    </ErrorBoundary>
  )
}
