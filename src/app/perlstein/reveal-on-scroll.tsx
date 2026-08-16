'use client';

import { useEffect } from 'react';

export default function RevealOnScroll(): null {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (nodes.length === 0 || !('IntersectionObserver' in window)) return undefined;
    root.setAttribute('data-perlstein-reveal', '');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-inview', '');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.15 });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      root.removeAttribute('data-perlstein-reveal');
    };
  }, []);
  return null;
}
