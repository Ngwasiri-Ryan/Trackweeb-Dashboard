import { useEffect, useMemo, useState } from "react";

export function useClientPagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);

  const slice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    totalPages,
    slice,
    reset: () => setPage(1),
  };
}

export function rowNumber(page: number, pageSize: number, index: number) {
  return (page - 1) * pageSize + index + 1;
}
