import {
  Link as RRLink,
  Navigate,
  useLocation,
  useNavigate as useRRNavigate,
  useSearchParams,
} from "react-router-dom";
import type { ComponentProps, ReactNode } from "react";

type SearchRecord = Record<string, unknown>;

type NavigateOpts = {
  to?: string;
  params?: Record<string, string>;
  search?: SearchRecord | ((prev: SearchRecord) => SearchRecord);
  replace?: boolean;
};

function resolvePath(to: string, params?: Record<string, string>) {
  let path = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`$${key}`, encodeURIComponent(value));
    }
  }
  return path;
}

function buildSearch(
  search?: SearchRecord | ((prev: SearchRecord) => SearchRecord),
  prev: SearchRecord = {},
) {
  const resolved = typeof search === "function" ? search(prev) : search;
  if (!resolved) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function Link({
  to,
  params,
  search,
  children,
  ...props
}: {
  to: string;
  params?: Record<string, string>;
  search?: SearchRecord;
  children?: ReactNode;
} & Omit<ComponentProps<typeof RRLink>, "to">) {
  const href = resolvePath(to, params) + buildSearch(search);
  return (
    <RRLink to={href} {...props}>
      {children}
    </RRLink>
  );
}

export function useNavigate() {
  const navigate = useRRNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prevSearch = Object.fromEntries(searchParams.entries()) as SearchRecord;

  return (opts: NavigateOpts | string) => {
    if (typeof opts === "string") {
      navigate(opts);
      return;
    }
    const basePath = opts.to ? resolvePath(opts.to, opts.params) : location.pathname;
    const href = basePath + buildSearch(opts.search, prevSearch);
    navigate(href, { replace: opts.replace });
  };
}

export { Navigate, useLocation, useSearchParams };
