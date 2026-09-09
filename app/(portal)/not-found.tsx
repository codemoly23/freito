import { NotFoundState } from "@/components/not-found-state";

export default function PortalNotFound() {
  return (
    <NotFoundState
      description="The page you're looking for doesn't exist or may have been removed."
      homeHref="/portal"
      homeLabel="Back to portal"
    />
  );
}
