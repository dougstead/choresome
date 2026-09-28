"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * A number field that can be cleared while typing. Clamping on every keystroke
 * (the old `Math.max(1, Number(e.target.value))` pattern) snaps an empty field
 * straight back to "1", so replacing a 1 with a 5 meant typing "15" and then
 * deleting the 1. Here the raw text is kept as a draft; the parent only hears
 * about values that are already in range, and the field is clamped on blur.
 */
export function NumberInput({ value, onChange, min, max, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Pick up changes pushed from outside (e.g. settings arriving from SWR).
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(draft) !== value || draft.trim() === "") setDraft(String(value));
  }

  function clamp(n: number) {
    let out = Math.round(n);
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onFocus={(e) => {
        e.target.select();
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== "" && Number.isFinite(n) && clamp(n) === n && n !== value) {
          setLastValue(n);
          onChange(n);
        }
      }}
      onBlur={(e) => {
        const n = Number(draft);
        const next = draft.trim() === "" || !Number.isFinite(n) ? value : clamp(n);
        setDraft(String(next));
        if (next !== value) {
          setLastValue(next);
          onChange(next);
        }
        onBlur?.(e);
      }}
    />
  );
}
