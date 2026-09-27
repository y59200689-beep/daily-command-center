"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

const quotes = [
  "Small steps every day add up to big changes.",
  "Show up today. Strength follows.",
  "Your pace is still progress.",
  "One walk can turn your day around.",
  "Build habits that carry you forward.",
  "Every rep is a fresh beginning.",
  "Consistency grows one day at a time.",
  "Move a little. Feel a little brighter.",
  "Make room for movement today.",
  "Strong starts with showing up.",
  "Celebrate the effort you put in.",
  "Your next step matters.",
  "Progress does not need to be perfect.",
  "Give your body time to grow stronger.",
  "A gentle day still counts.",
  "Find joy in what your body can do.",
  "Keep promises small and keep them often.",
  "Rest is part of getting stronger.",
  "Start where you are. Build from there.",
  "Let today be another small win.",
  "Breathe deeply. Move with purpose.",
  "Strength takes practice and patience.",
  "Choose a pace you can return to.",
  "A few minutes of movement count.",
  "You are building more than muscle.",
  "Let effort be enough for today.",
  "Fresh air and a few steps await.",
  "Listen to your body. Honor its rhythm.",
  "Make your next move a kind one.",
  "Keep going, one good habit at a time.",
  "Tomorrow starts with today's small step.",
] as const;

const storageKey = "fitness-daily-quote-v1";
type Selection = { day: string; index: number };
let memory: Selection | undefined;

function dailySelection(): Selection {
  const now = new Date();
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let previous = memory;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (stored && typeof stored.day === "string" && Number.isInteger(stored.index)
      && stored.index >= 0 && stored.index < quotes.length) previous = stored;
  } catch { /* Keep working when browser storage is unavailable. */ }
  if (previous?.day === day) return previous;

  // Avoid repeating the previous day's quote.
  let index = Math.floor(Math.random() * (quotes.length - (previous ? 1 : 0)));
  if (previous && index >= previous.index) index++;
  const selection = { day, index };
  memory = selection;
  try { localStorage.setItem(storageKey, JSON.stringify(selection)); } catch {}
  return selection;
}

export function DailyFitnessQuote() {
  const [quote, setQuote] = useState<string>(quotes[0]);

  useDeferredEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setQuote(quotes[dailySelection().index]);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []));

  return <p>{quote}</p>;
}
