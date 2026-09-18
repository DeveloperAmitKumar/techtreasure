"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function useDebouncedState<T>(
  initial: T,
  delayMs = 120
): [T, T, Dispatch<SetStateAction<T>>] {
  const [immediate, setImmediate] = useState<T>(initial);
  const [debounced, setDebounced] = useState<T>(initial);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(immediate), delayMs);
    return () => clearTimeout(t);
  }, [immediate, delayMs]);

  return [immediate, debounced, setImmediate];
}
