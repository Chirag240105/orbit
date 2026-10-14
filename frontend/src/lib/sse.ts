/** Parse a text/event-stream body into {event, data} pairs (data is JSON). Works with chunks split anywhere. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    buf = (buf + (done ? decoder.decode() : decoder.decode(value, { stream: true }))).replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, end);
      buf = buf.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) yield { event, data: JSON.parse(data.join("\n")) };
    }
    if (done) return;
  }
}
