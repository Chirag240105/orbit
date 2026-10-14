import type { ConsentDetails } from "../lib/api";
import { ConfirmDialog } from "./ui";

/** Shown when the backend answers 409 consent_required: workspace data would go to the hosted model. */
export function ConsentDialog({ details, onConfirm, onCancel }: { details: ConsentDetails | null; onConfirm: () => void; onCancel: () => void }) {
  const parts = [
    ...(details?.files.length ? [`${details.files.length} file(s): ${details.files.join(", ")}`] : []),
    ...(details?.layout ? ["the project layout (file names and dependency names)"] : []),
  ];
  return (
    <ConfirmDialog
      open={!!details}
      title="Send workspace data to a hosted model?"
      confirmLabel="Send"
      onCancel={onCancel}
      onConfirm={onConfirm}
      body={details && (
        <>
          <p>This leaves your computer for <b className="text-text">{details.model}</b>:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{parts.map((p) => <li key={p} className="break-words">{p}</li>)}</ul>
          <p className="mt-2">About {details.chars.toLocaleString()} characters{details.redactions ? `, with ${details.redactions} likely secret(s) redacted` : ""}. Redaction is best effort.</p>
        </>
      )}
    />
  );
}
