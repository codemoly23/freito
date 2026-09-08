import { redirect } from "next/navigation";
export default async function CarrierQueryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/carrier-queries/${id}`);
}
