import { NotFoundState } from "@/components/not-found-state";

export default function DashboardNotFound() {
  return (
    <NotFoundState
      description="The record or page you're looking for doesn't exist or may have been removed."
      homeHref="/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
