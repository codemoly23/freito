export type ReportSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getReportDateRange(params: ReportSearchParams) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const requestedFrom = validDate(firstParam(params.from));
  const requestedTo = validDate(firstParam(params.to));
  const from = requestedFrom ?? defaultFrom;
  const to = requestedTo ?? today;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const maxFrom = new Date(to);
  maxFrom.setFullYear(maxFrom.getFullYear() - 1);
  const normalizedFrom = from > to ? new Date(to) : from < maxFrom ? maxFrom : from;
  normalizedFrom.setHours(0, 0, 0, 0);

  return {
    from: normalizedFrom,
    to,
    fromInput: normalizedFrom.toISOString().slice(0, 10),
    toInput: to.toISOString().slice(0, 10),
  };
}

export function enumParam<const T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
) {
  const candidate = firstParam(value);
  return candidate && allowed.includes(candidate) ? candidate : undefined;
}
