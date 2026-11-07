// Small pieces shared by the list pages (My Applications, Leave Records).
// Server components: filters are a plain GET form and paging is plain links, so both work
// through the URL without any JavaScript.
import Link from "next/link";

/** Native <select> styled like the shadcn Input (a GET form needs real form fields). */
export const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

/** Builds "/path?a=1&b=2", skipping empty values. */
export function buildHref(path: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") sp.set(key, String(value));
  const query = sp.toString();
  return query ? `${path}?${query}` : path;
}

/** "Showing 20 of 57 · Previous · Page 1 of 3 · Next". hrefFor(n) gives the link to page n. */
export function Pagination({
  page,
  pages,
  shown,
  total,
  hrefFor,
}: {
  page: number;
  pages: number;
  shown: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-slate-500">
      <span>
        Showing {shown} of {total}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
            Previous
          </PageLink>
          <span>
            Page {page} of {pages}
          </span>
          <PageLink href={hrefFor(page + 1)} disabled={page >= pages}>
            Next
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-md border px-2.5 py-1 opacity-40">{children}</span>;
  return (
    <Link href={href} className="rounded-md border px-2.5 py-1 hover:bg-slate-50">
      {children}
    </Link>
  );
}
