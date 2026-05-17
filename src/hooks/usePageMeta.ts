import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  path?: string;
}

const BASE_URL = 'https://gesbase.lovable.app';

function upsertMeta(selector: string, create: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    document.title = title;

    if (description) {
      const desc = upsertMeta('meta[name="description"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        return m;
      });
      desc.setAttribute('content', description);
    }

    const ogTitle = upsertMeta('meta[property="og:title"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:title');
      return m;
    });
    ogTitle.setAttribute('content', title);

    if (description) {
      const ogDesc = upsertMeta('meta[property="og:description"]', () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:description');
        return m;
      });
      ogDesc.setAttribute('content', description);
    }

    const url = `${BASE_URL}${path ?? window.location.pathname}`;

    const ogUrl = upsertMeta('meta[property="og:url"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:url');
      return m;
    });
    ogUrl.setAttribute('content', url);

    const canonical = upsertMeta('link[rel="canonical"]', () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'canonical');
      return l;
    });
    canonical.setAttribute('href', url);
  }, [title, description, path]);
}
