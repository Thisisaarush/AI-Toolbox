import { ErrorBoundary } from "@/components/shared/error-boundary"
import ChroniclePage from "@/features/chronicle/page-content"

export default function ChronicleRoute() {
  return (
    <ErrorBoundary>
      <ChroniclePage />
    </ErrorBoundary>
  )
}
