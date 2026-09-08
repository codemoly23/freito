"use client";

import { useState } from "react";
import { Coins } from "lucide-react";

type ChargeProp = {
  chargeName: string;
  quantity: number;
  sellRate: number;
  sellAmount: number;
  currency: string;
};

const RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  BDT: 118.0,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.25,
  INR: 83.5,
  AED: 3.67,
  RUB: 90.0,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  BDT: "৳",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
  INR: "₹",
  AED: "د.إ",
  RUB: "₽",
};

function formatCurrency(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function QuotationChargesConverter({
  charges,
}: {
  charges: ChargeProp[];
}) {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  // 1. Convert all charges to USD first
  const usdCharges = charges.map((charge) => {
    const rateToUsd = RATES_TO_USD[charge.currency] || 1.0;
    const sellRateInUSD = charge.sellRate / rateToUsd;
    const sellAmountInUSD = charge.sellAmount / rateToUsd;
    return {
      ...charge,
      sellRateInUSD,
      sellAmountInUSD,
    };
  });

  const totalUSD = usdCharges.reduce((sum, c) => sum + c.sellAmountInUSD, 0);

  // 2. Convert from USD to target currency
  const targetRate = RATES_TO_USD[selectedCurrency] || 1.0;
  const convertedTotal = totalUSD * targetRate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Charges & Costing</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Default view is in USD. Choose a currency below to see estimated conversion.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="currency-select" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-slate-400" />
            <span>Convert To:</span>
          </label>
          <select 
            id="currency-select"
            value={selectedCurrency} 
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="USD">USD ($)</option>
            <option value="BDT">BDT (৳)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CNY">CNY (¥)</option>
            <option value="INR">INR (₹)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="RUB">RUB (₽)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="p-3 pl-0">Charge Description</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Rate (USD)</th>
              <th className="p-3 text-right">Amount (USD)</th>
              {selectedCurrency !== "USD" && (
                <th className="p-3 text-right text-cyan-600 font-semibold">
                  Amount ({selectedCurrency})
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {usdCharges.map((c, index) => {
              const convertedAmount = c.sellAmountInUSD * targetRate;
              return (
                <tr className="border-b border-slate-100 text-slate-700 hover:bg-slate-50/50" key={`${c.chargeName}-${index}`}>
                  <td className="p-3 pl-0 font-medium">{c.chargeName}</td>
                  <td className="p-3 text-center">{c.quantity}</td>
                  <td className="p-3 text-right">{formatCurrency(c.sellRateInUSD, "USD")}</td>
                  <td className="p-3 text-right">{formatCurrency(c.sellAmountInUSD, "USD")}</td>
                  {selectedCurrency !== "USD" && (
                    <td className="p-3 text-right text-cyan-600 font-semibold bg-cyan-50/20">
                      {formatCurrency(convertedAmount, selectedCurrency)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1.5 pt-4 border-t border-slate-100">
        <div className="text-right">
          <span className="text-xs text-slate-500">Total in USD:</span>
          <span className="ml-2 text-base font-semibold text-slate-700">{formatCurrency(totalUSD, "USD")}</span>
        </div>
        
        {selectedCurrency !== "USD" && (
          <div className="text-right bg-cyan-50 border border-cyan-100 rounded-lg px-4 py-2.5 mt-1">
            <span className="text-xs text-cyan-700 font-semibold">Estimated Total ({selectedCurrency}):</span>
            <span className="ml-2 text-xl font-bold text-cyan-800">{formatCurrency(convertedTotal, selectedCurrency)}</span>
            <p className="text-[10px] text-cyan-600 mt-1 flex items-center gap-1 justify-end">
              <Coins className="h-3 w-3" />
              <span>Exchange rate: 1 USD = {formatCurrency(targetRate, selectedCurrency).replace(/[^0-9.]/g, "")} {selectedCurrency}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
