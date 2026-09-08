"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles, X } from "lucide-react";

type SearchResult = {
  type: "customer" | "shipment" | "quotation" | "invoice" | "vendor" | "document";
  id: string;
  title: string;
  secondary: string | null;
  href: string;
  branchLabel: string | null;
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  customer: "Customer",
  shipment: "Shipment",
  quotation: "Quotation",
  invoice: "Invoice",
  vendor: "Vendor",
  document: "Document",
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function GlobalSearch({ canUseAi = false }: { canUseAi?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [aiMode, setAiMode] = useState(false);
  const [interpretedQuery, setInterpretedQuery] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();

    timerRef.current = setTimeout(
      () => {
        if (trimmed.length < MIN_QUERY_LENGTH) {
          setResults([]);
          setIsLoading(false);
          setHasError(false);
          setInterpretedQuery(null);
          return;
        }

        setIsLoading(true);
        setHasError(false);

        const controller = new AbortController();
        abortRef.current = controller;

        const params = new URLSearchParams({ q: trimmed });
        if (aiMode && canUseAi) params.set("ai", "1");

        fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error("search failed");
            return response.json();
          })
          .then((data: { results?: SearchResult[]; interpretedQuery?: string | null }) => {
            setResults(Array.isArray(data.results) ? data.results : []);
            setInterpretedQuery(data.interpretedQuery ?? null);
            setActiveIndex(-1);
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setHasError(true);
            setResults([]);
          })
          .finally(() => setIsLoading(false));
      },
      trimmed.length < MIN_QUERY_LENGTH ? 0 : DEBOUNCE_MS,
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, aiMode, canUseAi]);

  const navigateTo = useCallback(
    (href: string) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      router.push(href);
    },
    [router],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex >= 0 ? activeIndex : 0];
      if (target) navigateTo(target.href);
    }
  }

  const trimmedQuery = query.trim();
  const showDropdown = isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm md:block">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 text-sm text-slate-500 transition-all duration-250 focus-within:border-cyan-500/50 focus-within:bg-white hover:border-cyan-500/50">
        <Search className="h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Search jobs, BL/AWB, customer, quotation, invoice, vendor and documents"
          placeholder={aiMode && canUseAi ? "Ask in plain language..." : "Search jobs, BL/AWB, customer..."}
          className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {canUseAi ? (
          <button
            type="button"
            aria-pressed={aiMode}
            aria-label={aiMode ? "Ask AI mode on -- click to search by keyword instead" : "Switch to Ask AI mode"}
            title={aiMode ? "Ask AI mode: describe what you're looking for in plain language" : "Switch to Ask AI mode"}
            className={`shrink-0 rounded-md p-1 transition-colors ${aiMode ? "text-purple-600" : "text-slate-300 hover:text-purple-500"}`}
            onClick={() => setAiMode((value) => !value)}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="shrink-0 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 lg:inline">
            Ctrl K
          </kbd>
        )}
      </div>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {interpretedQuery && !isLoading ? (
            <p className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-[11px] text-purple-600">
              <Sparkles className="h-3 w-3 shrink-0" /> Searched for &quot;{interpretedQuery}&quot;
            </p>
          ) : null}
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : hasError ? (
            <p className="px-3 py-3 text-sm text-slate-500">Search is temporarily unavailable.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No matches for &quot;{trimmedQuery}&quot;.</p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateTo(result.href)}
              >
                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {TYPE_LABELS[result.type] ?? result.type}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{result.title}</span>
                  {result.secondary ? (
                    <span className="block truncate text-xs text-slate-500">{result.secondary}</span>
                  ) : null}
                </span>
                {result.branchLabel ? (
                  <span className="shrink-0 text-[10px] text-slate-400">{result.branchLabel}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
