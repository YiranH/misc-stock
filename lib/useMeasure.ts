// lib/useMeasure.ts
import { useCallback, useEffect, useState } from 'react';

export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    update(); // grab the initial size
    const ro = new ResizeObserver(update);
    ro.observe(node);

    return () => ro.disconnect();
  }, [node]);

  return { ref, width: size.width, height: size.height } as const;
}
