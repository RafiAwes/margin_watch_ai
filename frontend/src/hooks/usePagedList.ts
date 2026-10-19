import { useEffect, useRef, useState } from 'react';
import { Page } from '../services/auth-and-store';

/**
 * Loads a server-paginated list one page at a time (DEC-008: never fetch whole collections).
 * Reloads from page 1 whenever `deps` change (e.g. filters or a data-version counter);
 * `loadMore` appends the next page.
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  deps: unknown[],
  enabled = true
) {
  const [items, setItems] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always call the latest fetcher without making it a dependency
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (!enabled) {
      setItems([]);
      setCount(0);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchRef
      .current(1)
      .then((res) => {
        if (id !== requestId.current) return;
        setItems(res.results);
        setCount(res.count);
        setHasMore(Boolean(res.next));
        setPage(1);
      })
      .catch((err) => {
        if (id === requestId.current) setError(err?.message || 'Could not load this list.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    const id = requestId.current;
    setLoading(true);
    try {
      const res = await fetchRef.current(page + 1);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...res.results]);
      setCount(res.count);
      setHasMore(Boolean(res.next));
      setPage(page + 1);
    } catch (err: any) {
      if (id === requestId.current) setError(err?.message || 'Could not load more rows.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return { items, count, hasMore, loading, error, loadMore };
}
