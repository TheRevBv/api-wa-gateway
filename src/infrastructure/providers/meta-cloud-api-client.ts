import { ApplicationError } from "../../application/errors/application-error";

export interface MetaSendMessageRequest {
  accessToken: string;
  apiVersion: string;
  baseUrl: string;
  phoneNumberId: string;
  to: string;
  payload: Record<string, unknown>;
}

export interface MetaSendMessageResponse {
  messageId: string;
  messageStatus: "accepted" | "sent" | null;
  payloadRaw: unknown;
}

export interface MetaUploadMediaRequest {
  accessToken: string;
  apiVersion: string;
  baseUrl: string;
  phoneNumberId: string;
  mediaUrl: string;
  mimeType?: string;
  fileName?: string;
}

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const extractMetaErrorMessage = (body: unknown): string | null => {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const error = (body as { error?: unknown }).error;

  if (typeof error !== "object" || error === null) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  const details = (error as { error_data?: { details?: unknown } }).error_data?.details;

  if (typeof details === "string" && details.length > 0) {
    return details;
  }

  return typeof message === "string" && message.length > 0 ? message : null;
};

export class MetaCloudApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async uploadMedia(request: MetaUploadMediaRequest): Promise<string> {
    const mediaResponse = await this.fetchImpl(request.mediaUrl, {
      method: "GET"
    });

    if (!mediaResponse.ok) {
      throw new ApplicationError(
        `Meta media relay could not fetch the attachment: ${mediaResponse.status}`,
        {
          code: "provider_send_failed",
          statusCode: 502
        }
      );
    }

    const contentTypeHeader = mediaResponse.headers.get("content-type");
    const mimeType =
      request.mimeType || (contentTypeHeader && contentTypeHeader.split(";")[0]) || "application/octet-stream";
    const fileName = request.fileName || "attachment";
    const bytes = await mediaResponse.arrayBuffer();
    const formData = new FormData();

    formData.set("messaging_product", "whatsapp");
    formData.set("type", mimeType);
    formData.set("file", new Blob([bytes], { type: mimeType }), fileName);

    const response = await this.fetchImpl(
      `${request.baseUrl.replace(/\/$/, "")}/${request.apiVersion}/${request.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.accessToken}`
        },
        body: formData
      }
    );
    const body = await parseResponseBody(response);

    if (!response.ok) {
      const detail = extractMetaErrorMessage(body);
      throw new ApplicationError(
        detail ? `Meta rejected the media upload: ${detail}` : "Meta rejected the media upload",
        {
          code: "provider_send_failed",
          statusCode: 502
        }
      );
    }

    const mediaId =
      typeof body === "object" && body !== null && typeof (body as { id?: unknown }).id === "string"
        ? ((body as { id: string }).id)
        : null;

    if (!mediaId) {
      throw new ApplicationError("Meta returned an invalid media upload response", {
        code: "provider_send_failed",
        statusCode: 502
      });
    }

    return mediaId;
  }

  async sendMessage(request: MetaSendMessageRequest): Promise<MetaSendMessageResponse> {
    const response = await this.fetchImpl(
      `${request.baseUrl.replace(/\/$/, "")}/${request.apiVersion}/${request.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: request.to,
          ...request.payload
        })
      }
    );
    const body = await parseResponseBody(response);

    if (!response.ok) {
      const detail = extractMetaErrorMessage(body);
      throw new ApplicationError(
        detail ? `Meta rejected the outbound message: ${detail}` : "Meta rejected the outbound message",
        {
          code: "provider_send_failed",
          statusCode: 502
        }
      );
    }

    const messageId = Array.isArray((body as { messages?: unknown[] } | null)?.messages)
      ? (((body as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null) as string | null)
      : null;

    if (!messageId) {
      throw new ApplicationError("Meta returned an invalid send response", {
        code: "provider_send_failed",
        statusCode: 502
      });
    }

    return {
      messageId,
      messageStatus:
        (Array.isArray((body as { messages?: unknown[] } | null)?.messages)
          ? ((body as { messages?: Array<{ message_status?: unknown }> }).messages?.[0]?.message_status ?? null)
          : null) === "accepted"
          ? "accepted"
          : null,
      payloadRaw: body
    };
  }
}
