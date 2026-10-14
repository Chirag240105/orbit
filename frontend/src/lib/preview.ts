const MAIN_FIELD = /"(answer|summary|overview|explanation)"\s*:\s*"((?:[^"\\]|\\.)*)/;

/** Readable text from a partially streamed reply. Skills answer in JSON, so this shows the main text field as it
 * grows instead of raw braces. Falls back to the raw text when the reply is not JSON. */
export function streamPreview(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("```")) return raw;
  const m = MAIN_FIELD.exec(raw);
  if (!m) return "";
  let body = m[2].replace(/\\u[0-9a-fA-F]{0,3}$|\\$/, ""); // drop an escape cut off mid-stream
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    body = body.replace(/\\(.)/g, "$1");
    return body;
  }
}
