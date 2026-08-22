"use client";

/**
 * Client island for /help. Owns the search input + accordion state.
 *
 * The full FAQ list is shipped from the server (good for SEO / first paint);
 * this component just hides items whose question + answer don't match the
 * 200ms-debounced query. Topic groupings are preserved so users always see the
 * structure even when filtering.
 */

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FaqEntry, FaqTopic } from "./faq-data";

type Props = {
  entries: FaqEntry[];
  topics: FaqTopic[];
};

export function FaqSearch({ entries, topics }: Props) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  // 200ms debounce
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const filtered = useMemo(() => {
    if (!query) return entries;
    return entries.filter(
      (e) =>
        e.question.toLowerCase().includes(query) ||
        e.answer.toLowerCase().includes(query),
    );
  }, [entries, query]);

  const grouped = useMemo(() => {
    const map = new Map<FaqTopic, FaqEntry[]>();
    for (const topic of topics) map.set(topic, []);
    for (const e of filtered) map.get(e.topic)?.push(e);
    return map;
  }, [filtered, topics]);

  const totalMatches = filtered.length;
  const hasResults = totalMatches > 0;

  return (
    <div>
      <div className="relative mb-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          aria-label="Search the FAQ"
          placeholder="Search e.g. 'trial', 'parent reports', 'OTP'"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className="h-12 pl-11 pr-11 text-base rounded-xl"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => setRawQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query && (
        <p className="mb-6 text-xs text-muted-foreground">
          {totalMatches === 0
            ? "No matches yet — try a different keyword."
            : `${totalMatches} match${totalMatches === 1 ? "" : "es"} for "${query}".`}
        </p>
      )}

      {!hasResults && query && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Can't find what you're looking for? Email{" "}
            <a
              href="mailto:hello@testquest.in"
              className="text-primary hover:underline"
            >
              hello@testquest.in
            </a>{" "}
            and a real person will reply within a working day.
          </p>
        </div>
      )}

      <div className="space-y-12">
        {topics.map((topic) => {
          const items = grouped.get(topic) ?? [];
          if (items.length === 0) return null;
          return (
            <section
              key={topic}
              aria-labelledby={`faq-topic-${slug(topic)}`}
              className={cn(
                "scroll-mt-24",
              )}
            >
              <h2
                id={`faq-topic-${slug(topic)}`}
                className="font-display text-2xl md:text-3xl tracking-tight mb-4"
              >
                {topic}
              </h2>
              <Accordion type="multiple" className="rounded-2xl border bg-surface/40 px-5">
                {items.map((entry) => (
                  <AccordionItem key={entry.id} value={entry.id}>
                    <AccordionTrigger className="text-base font-medium">
                      {entry.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {entry.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          );
        })}
      </div>

      <div className="mt-16 rounded-3xl border bg-surface/60 p-8 md:p-10 text-center">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight">
          Still stuck?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Email us — we read every message and reply within one working day.
        </p>
        <Button asChild className="mt-5">
          <a href="mailto:hello@testquest.in">Email hello@testquest.in</a>
        </Button>
      </div>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
