import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

interface MediaUploadRecord {
  id: string;
  path: string;
  contentType: string | null;
}

interface MessageDispatchRecord {
  id: string;
  path: string;
  type: string;
  to: string | null;
  payload: Record<string, unknown>;
  failed: boolean;
}

const port = Number(process.env.PORT ?? 8101);
const mediaUploads: MediaUploadRecord[] = [];
const messageDispatches: MessageDispatchRecord[] = [];
const failedOnceKeys = new Set<string>();

function json(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function extractMessageSummary(payload: Record<string, unknown>) {
  if (payload.type === "text") {
    return String((payload.text as { body?: string } | undefined)?.body ?? "");
  }

  if (payload.type === "template") {
    const template = payload.template as
      | {
          name?: string;
          components?: Array<{
            type?: string;
            parameters?: Array<{ text?: string }>;
          }>;
        }
      | undefined;
    const parameters =
      template?.components
        ?.flatMap((component) =>
          component.type === "body"
            ? (component.parameters ?? []).map((parameter) => parameter.text ?? "")
            : [],
        )
        .filter((value) => value.length > 0) ?? [];

    return [template?.name ?? "", ...parameters].join("|");
  }

  if (payload.type === "image") {
    return String((payload.image as { caption?: string } | undefined)?.caption ?? "");
  }

  if (payload.type === "document") {
    return String((payload.document as { caption?: string } | undefined)?.caption ?? "");
  }

  return "";
}

function shouldFailOnce(payload: Record<string, unknown>) {
  const summary = extractMessageSummary(payload);

  return summary.includes("[manual-retry]") || summary.includes("__fail_once__");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/_debug/reset") {
    mediaUploads.splice(0, mediaUploads.length);
    messageDispatches.splice(0, messageDispatches.length);
    failedOnceKeys.clear();
    json(response, 200, { reset: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/_debug/messages") {
    json(response, 200, { items: messageDispatches });
    return;
  }

  if (request.method === "GET" && url.pathname === "/_debug/media") {
    json(response, 200, { items: mediaUploads });
    return;
  }

  if (request.method === "POST" && /\/[^/]+\/[^/]+\/media$/.test(url.pathname)) {
    const mediaId = `meta-media-${crypto.randomUUID()}`;

    mediaUploads.unshift({
      id: mediaId,
      path: url.pathname,
      contentType: request.headers["content-type"] ?? null,
    });

    json(response, 200, { id: mediaId });
    return;
  }

  if (request.method === "POST" && /\/[^/]+\/[^/]+\/messages$/.test(url.pathname)) {
    const rawBody = await readBody(request);
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const failureKey = `${payload.to ?? "unknown"}::${extractMessageSummary(payload)}`;
    const failed = shouldFailOnce(payload) && !failedOnceKeys.has(failureKey);

    if (failed) {
      failedOnceKeys.add(failureKey);
      messageDispatches.unshift({
        id: `failed-${crypto.randomUUID()}`,
        path: url.pathname,
        type: String(payload.type ?? "unknown"),
        to: typeof payload.to === "string" ? payload.to : null,
        payload,
        failed: true,
      });
      json(response, 502, {
        error: {
          message: "Mock transient send failure",
          error_data: {
            details: "Mock transient send failure",
          },
        },
      });
      return;
    }

    const messageId = `wamid.mock.${crypto.randomUUID()}`;

    messageDispatches.unshift({
      id: messageId,
      path: url.pathname,
      type: String(payload.type ?? "unknown"),
      to: typeof payload.to === "string" ? payload.to : null,
      payload,
      failed: false,
    });

    json(response, 200, {
      messaging_product: "whatsapp",
      contacts: [{ input: payload.to, wa_id: payload.to }],
      messages: [{ id: messageId, message_status: "accepted" }],
    });
    return;
  }

  json(response, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[mock-meta-cloud-api] listening on http://127.0.0.1:${port}`);
});
