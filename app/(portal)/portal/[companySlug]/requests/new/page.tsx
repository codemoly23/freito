import Link from "next/link";
import { createPortalShipmentRequest } from "@/lib/actions/shipment-requests";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { ShipmentRequestForm } from "@/components/forms/shipment-request-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ companySlug: string }> };

export default async function NewPortalRequestPage({ params }: PageProps) {
  const { companySlug } = await params;
  await requirePortalAccount(companySlug);
  const action = createPortalShipmentRequest.bind(null, companySlug);
  return (
    <main className="min-h-screen bg-slate-50 p-5">
      <div className="mx-auto max-w-5xl space-y-5">
        <Button asChild variant="outline"><Link href={`/portal/${companySlug}/requests`}>Back to requests</Link></Button>
        <Card>
          <CardHeader><CardTitle>New Shipment Request</CardTitle><CardDescription>Tell us what you need moved and the service scope required.</CardDescription></CardHeader>
          <CardContent><ShipmentRequestForm action={action} /></CardContent>
        </Card>
      </div>
    </main>
  );
}
