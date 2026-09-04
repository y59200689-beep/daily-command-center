import { useEffect } from "react";

export function useDeferredEffect(effect: () => void | (() => void)) {
  useEffect(() => {
    let cleanup: void | (() => void);
    const timer = window.setTimeout(() => { cleanup = effect(); }, 0);
    return () => { window.clearTimeout(timer); cleanup?.(); };
  }, [effect]);
}
