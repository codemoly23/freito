import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ReportHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/reports"><ArrowLeft className="h-4 w-4" />Report Center</Link>
      </Button>
      <Badge className="mt-3 block w-fit" variant="secondary">Report Center</Badge>
      <h1 className="mt-3 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function MetricGrid({
  metrics,
}: {
  metrics: { label: string; value: ReactNode; detail?: string }[];
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
            {metric.detail ? <p className="mt-2 text-xs text-slate-500">{metric.detail}</p> : null}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function ReportFilters({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter this report</CardTitle>
        <CardDescription>Choose a date range, then narrow the table with optional filters. Date range is limited to one year.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input aria-label="From date" name="from" type="date" defaultValue={from} />
          <Input aria-label="To date" name="to" type="date" defaultValue={to} />
          {children}
          <Button type="submit" variant="secondary"><Filter className="h-4 w-4" />Apply filters</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReportTable({
  title,
  description,
  headers,
  rows,
  empty = "No records found for this period.",
}: {
  title: string;
  description?: string;
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>{headers.map((header) => <th className="px-4 py-3 font-medium" key={header}>{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((row, index) => (
                <tr key={index}>{row.map((cell, cellIndex) => <td className="px-4 py-3 text-slate-700" key={cellIndex}>{cell}</td>)}</tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={headers.length}>
                    <p>{empty}</p>
                    <p className="mt-1 text-xs">Try changing the date range or clearing optional filters.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
