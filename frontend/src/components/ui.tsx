import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { ApiError } from "../lib/api";
import { errorHelp } from "../lib/errors";

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };
const VARIANTS = {
  primary: "bg-accent text-bg hover:brightness-110",
  secondary: "bg-raised text-text border border-line hover:border-muted",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/20",
  ghost: "text-muted hover:text-text hover:bg-raised",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", className, type = "button", ...p }, ref) {
  return <button ref={ref} type={type} {...p} className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", VARIANTS[variant], className)} />;
});

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-lg border border-line bg-surface", className)}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
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

/** Renders `code` spans written with backticks. */
const withCode = (s: string) => s.split("`").map((part, i) => (i % 2 ? <code key={i} className="font-mono">{part}</code> : part));

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const help = errorHelp(e?.code);
  const inRouter = useInRouterContext();
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="font-medium text-danger">{help.title}</p>
      <p className="mt-1 text-text/90">{e?.message ?? "Unexpected error."}</p>
      {help.hint && <p className="mt-1 text-text/80">{withCode(help.hint)}</p>}
      {((retry && help.retry) || help.link) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {retry && help.retry && <Button onClick={retry}>Try again</Button>}
          {help.link && (inRouter
            ? <Link to={help.link.to} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-muted">{help.link.label}</Link>
            : <a href={help.link.to} className="rounded-md border border-line px-3 py-1.5 font-medium">{help.link.label}</a>)}
        </div>
      )}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx("animate-pulse rounded bg-raised", className ?? "h-4 w-full")} />;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted focus:border-accent";

/** Modal confirmation. The native <dialog> traps focus and closes on Escape; destructive dialogs focus Cancel first. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    (danger ? cancelRef : confirmRef).current?.focus();
    return () => opener?.focus?.(); // give focus back to whatever opened the dialog
  }, [open, danger]);
  if (!open) return null;
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="dlg-title" aria-describedby="dlg-body" className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-5 text-text backdrop:bg-black/60">
      <h2 id="dlg-title" className="font-semibold">{title}</h2>
      <div id="dlg-body" className="mt-2 text-sm text-muted">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button ref={cancelRef} onClick={onCancel}>Cancel</Button>
        <Button ref={confirmRef} variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}

export function SkipLink() {
  return <a href="#main" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>;
}
