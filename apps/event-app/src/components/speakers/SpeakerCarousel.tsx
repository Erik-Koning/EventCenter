"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useEventStore } from "@/lib/stores/eventStore";
import { useEventSpeakers, useEventSessions } from "@/hooks/useEventData";
import { SpeakerCard } from "./SpeakerCard";
import { SpeakersSkeleton } from "@/components/skeletons/SpeakersSkeleton";

const AUTO_INTERVAL = 10000;
const PAUSE_DURATION = 30000;

export function SpeakerCarousel() {
  const currentEvent = useEventStore((s) => s.currentEvent);
  const { data: speakers, isLoading } = useEventSpeakers(currentEvent?.id);
  const { data: sessions } = useEventSessions(currentEvent?.id);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (next: number, dir: number) => {
      setDirection(dir);
      setIndex(next);
    },
    []
  );

  const manualGo = useCallback(
    (next: number, dir: number) => {
      go(next, dir);
      setPaused(true);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => setPaused(false), PAUSE_DURATION);
    },
    [go]
  );

  const handlePrev = useCallback(() => {
    if (speakers.length === 0) return;
    manualGo(index === 0 ? speakers.length - 1 : index - 1, -1);
  }, [index, manualGo, speakers.length]);

  const handleNext = useCallback(() => {
    if (speakers.length === 0) return;
    manualGo(index === speakers.length - 1 ? 0 : index + 1, 1);
  }, [index, manualGo, speakers.length]);

  // Auto-advance, disabled while paused
  useEffect(() => {
    if (paused || speakers.length === 0) return;
    timerRef.current = setTimeout(() => {
      go(index === speakers.length - 1 ? 0 : index + 1, 1);
    }, AUTO_INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, go, paused, speakers.length]);

  // Cleanup pause timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  // Reset index when speakers change
  useEffect(() => {
    setIndex(0);
  }, [speakers.length]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
      filter: "blur(4px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
      filter: "blur(4px)",
    }),
  };

  if (isLoading) {
    return <SpeakersSkeleton />;
  }

  if (speakers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No speakers found for this event.
      </div>
    );
  }

  const currentSpeaker = speakers[index];

  return (
    <div className="flex flex-col items-center">
      {/* Carousel viewport */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent px-6 py-12">
        {/* Progress bar */}
        <div className="absolute left-0 top-0 h-0.5 w-full bg-muted">
          <motion.div
            key={`${index}-${paused}`}
            className="h-full bg-primary/40"
            initial={{ width: "0%" }}
            animate={{ width: paused ? "0%" : "100%" }}
            transition={paused ? { duration: 0 } : { duration: AUTO_INTERVAL / 1000, ease: "linear" }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSpeaker.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <SpeakerCard speaker={currentSpeaker} sessions={sessions} />
          </motion.div>
        </AnimatePresence>

        {/* Arrow buttons */}
        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-2 shadow-sm transition-colors hover:bg-muted"
          aria-label="Previous speaker"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-2 shadow-sm transition-colors hover:bg-muted"
          aria-label="Next speaker"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Indicator dots */}
      <div className="mt-6 flex items-center gap-2">
        {speakers.map((speaker, i) => (
          <button
            key={speaker.id}
            onClick={() => manualGo(i, i > index ? 1 : -1)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === index
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/20 hover:bg-muted-foreground/40"
            )}
            aria-label={`Go to ${speaker.name}`}
          />
        ))}
      </div>
    </div>
  );
}
