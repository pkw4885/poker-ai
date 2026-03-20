"use client";

import { useState, useEffect, useRef } from "react";

interface TurnTimerProps {
  duration: number;
  isActive: boolean;
  onTimeout?: () => void;
}

export default function TurnTimer({
  duration,
  isActive,
  onTimeout,
}: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(duration);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setTimeLeft(duration);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onTimeoutRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, duration]);

  if (!isActive) return null;

  const pct = (timeLeft / duration) * 100;
  const urgent = timeLeft <= 5;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">
          Time
        </span>
        <span
          className={`text-xs font-mono ${urgent ? "text-[#ff4444]" : "text-[#999]"}`}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="h-[2px] bg-[#222] w-full relative">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-1000 linear ${
            urgent ? "bg-[#ff4444]" : "bg-white"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
