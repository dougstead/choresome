"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, UndoIcon } from "./icons";

interface ToastState {
  message: string;
  onUndo: (() => void | Promise<void>) | null;
}

interface UndoToastContextValue {
  show: (message: string, onUndo?: () => void | Promise<void>) => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, onUndo?: () => void | Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, onUndo: onUndo ?? null });
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <UndoToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
        {toast ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-text px-4 py-2.5 shadow-lg">
            <CheckIcon width={16} height={16} className="shrink-0 text-bg" />
            <span className="text-sm font-semibold text-bg">{toast.message}</span>
            {toast.onUndo ? (
              <button
                onClick={async () => {
                  const undo = toast.onUndo;
                  setToast(null);
                  await undo?.();
                }}
                className="flex items-center gap-1 rounded-full bg-bg/15 px-2.5 py-1 text-sm font-bold text-bg"
              >
                <UndoIcon width={14} height={14} />
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error("useUndoToast must be used within UndoToastProvider");
  return ctx;
}
