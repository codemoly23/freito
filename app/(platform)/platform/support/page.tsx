import { BookOpen, Bug, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformPermission } from "@/lib/permissions/rbac";

const supportCards = [
  {
    title: "Contact support",
    description: "Contact your designated freight-control support administrator for account or platform assistance.",
    icon: LifeBuoy,
  },
  {
    title: "Documentation",
    description: "Use the approved internal operating guides and release notes for platform procedures.",
    icon: BookOpen,
  },
  {
    title: "Issue reporting",
    description: "Record the affected page, expected result, and observed result before reporting an issue.",
    icon: Bug,
  },
];

export default async function PlatformSupportPage() {
  await requirePlatformPermission("platform:support:access");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Support</h1>
        <p className="mt-1 text-sm text-slate-600">
          Basic help resources for platform operators. No external support integration is enabled.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {supportCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <card.icon className="h-5 w-5 text-cyan-700" />
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {card.description}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
