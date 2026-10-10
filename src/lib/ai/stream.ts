import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { aiErrorMessage } from "./client";
import { recordUsage } from "./quota";

type ClaudeStream = ReturnType<Anthropic["messages"]["stream"]>;

/**
 * Streams Claude's reply to the browser as plain text. Billed tokens are recorded exactly once, whether the
 * reply finishes, fails or the client hangs up, and `onFinish` gets whatever text was written.
 */
export function textResponse(
  stream: ClaudeStream,
  userId: string,
  { headers, onFinish }: { headers?: Record<string, string>; onFinish?: (text: string, usage: Anthropic.Usage | undefined) => Promise<void> } = {},
) {
  let finished = false;
  let text = "";
  const finish = async (usage: Anthropic.Usage | undefined) => {
    if (finished) return;
    finished = true;
    await Promise.all([usage && recordUsage(userId, usage), onFinish?.(text, usage)]);
  };

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        await finish((await stream.finalMessage()).usage);
        controller.close();
      } catch (err) {
        await finish(stream.currentMessage?.usage);
        console.error("claude stream failed", err instanceof Error ? err.name : err);
        controller.enqueue(encoder.encode(`\n\n[${aiErrorMessage(err, "Something went wrong. Please try again.")}]`));
        controller.close();
      }
    },
    async cancel() {
      const partial = stream.currentMessage;
      stream.abort();
      await finish(partial?.usage);
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
