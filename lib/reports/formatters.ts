export function decimalNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function reportMoney(value: unknown, currency = "BDT") {
  return `${currency} ${decimalNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function reportPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function reportDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-GB") : "-";
}

export function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}
