import { NotFoundState } from "@/components/not-found-state";

export default function PlatformNotFound() {
  return (
    <NotFoundState
      description="The record or page you're looking for doesn't exist or may have been removed."
      homeHref="/platform"
      homeLabel="Back to platform panel"
    />
  );
}
