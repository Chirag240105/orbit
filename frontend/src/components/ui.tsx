import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ApiError } from "../lib/api";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "secondary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-accent text-bg hover:brightness-110",
    secondary: "bg-raised text-text border border-line hover:border-muted",
    danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
    ghost: "text-muted hover:text-text hover:bg-raised",
  }[variant];
  return <button {...p} className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed", v, className)} />;
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tone = { neutral: "bg-raised text-muted", accent: "bg-accent/15 text-accent", warn: "bg-warn/15 text-warn", ok: "bg-ok/15 text-ok", danger: "bg-danger/15 text-danger" };
export function Badge({ children, color = "neutral" }: { children: ReactNode; color?: keyof typeof tone }) {
  return <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", tone[color])}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="font-medium text-danger">{e?.code === "backend_unreachable" ? "Backend not reachable" : "Something went wrong"}</p>
      <p className="mt-1 text-text/90">{e?.message ?? "Unexpected error."}</p>
      {retry && <Button className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx("animate-pulse rounded bg-raised", className ?? "h-4 w-full")} />;

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[20rem] items-center justify-center" aria-busy="true" role="status">
      <div className="text-sm text-muted">Loading…</div>
    </div>
  );
}

/** Full-page loading skeleton for data-heavy pages. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent";

export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.() ?? d.setAttribute("open", "");
    if (!open && d.open) d.close?.();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="dlg-title" className="m-auto w-[min(28rem,92vw)] rounded-lg border border-line bg-surface p-5 text-text backdrop:bg-black/60">
      <h2 id="dlg-title" className="font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-muted">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
