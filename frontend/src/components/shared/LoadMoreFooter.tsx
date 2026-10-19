import React from 'react';

/** "Showing x of y" + Load more button for server-paginated lists. */
export const LoadMoreFooter: React.FC<{
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error?: string | null;
  onLoadMore: () => void;
  noun?: string;
}> = ({ shown, total, hasMore, loading, error, onLoadMore, noun = 'rows' }) => {
  if (total === 0 && !loading && !error) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-xs text-slate-600">
      <span role="status" aria-live="polite">
        {error ? (
          <span className="text-red-700">{error}</span>
        ) : loading && shown === 0 ? (
          `Loading ${noun}...`
        ) : (
          `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`
        )}
      </span>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="px-3 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
};
