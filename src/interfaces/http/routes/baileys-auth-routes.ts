import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import QRCode from "qrcode";
import { z } from "zod";

import type { HttpRouteDependencies } from "./dependencies";

const authQuerySchema = z.object({
  auth: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  connectionKey: z.string().min(1).optional()
});

const unauthorized = {
  error: {
    code: "unauthorized",
    message: "Invalid auth token"
  }
};

interface DashboardSessionItem {
  connectionId: string;
  tenantId: string;
  connectionKey: string;
  displayName: string;
  status: string;
  statusLabel: string;
  statusMessage: string;
  qrCodeDataUrl: string | null;
  lastError: string | null;
  updatedAt: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildStatusMessage = (item: {
  status: string;
  lastError: string | null;
}): string => {
  if (item.status === "qr_ready") {
    return "Escanea este QR desde WhatsApp en el telefono.";
  }

  if (item.status === "connected") {
    return "Sesion conectada.";
  }

  if (item.status === "connecting") {
    return "Esperando QR o apertura de sesion.";
  }

  if (item.status === "disabled") {
    return "Baileys esta deshabilitado.";
  }

  if (item.status === "disconnected") {
    return "La conexion se cerro. El sistema intentara reconectar.";
  }

  return item.lastError ?? "Aun no hay QR disponible para esta sesion.";
};

const buildDashboardSessionItems = async (
  sessions: Awaited<ReturnType<HttpRouteDependencies["baileysSessionView"]["listSessions"]>>
): Promise<DashboardSessionItem[]> =>
  Promise.all(
    sessions.map(async (session) => ({
      connectionId: session.connectionId,
      tenantId: session.tenantId,
      connectionKey: session.connectionKey,
      displayName: session.displayName,
      status: session.status,
      statusLabel: session.status.replaceAll("_", " "),
      statusMessage: buildStatusMessage(session),
      qrCodeDataUrl: session.qrCode ? await QRCode.toDataURL(session.qrCode, { margin: 1, width: 320 }) : null,
      lastError: session.lastError,
      updatedAt: session.updatedAt.toISOString()
    }))
  );

const renderDashboardCard = (item: DashboardSessionItem): string => {
  const qrMarkup = item.qrCodeDataUrl
    ? `<img alt="Baileys QR" src="${item.qrCodeDataUrl}" />`
    : `<div style="padding:24px;text-align:center;color:#58645f;">${escapeHtml(item.statusMessage)}</div>`;

  const errorMarkup = item.lastError
    ? `<div class="error" style="margin-top:14px;">${escapeHtml(item.lastError)}</div>`
    : "";

  return `<article class="card">
    <header>
      <div>
        <h2>${escapeHtml(item.displayName)}</h2>
        <div style="color:#58645f;font-size:14px;">${escapeHtml(item.connectionKey)}</div>
      </div>
      <span class="status ${escapeHtml(item.status)}">${escapeHtml(item.statusLabel)}</span>
    </header>
    <dl>
      <dt>Tenant</dt><dd>${escapeHtml(item.tenantId)}</dd>
      <dt>Connection</dt><dd>${escapeHtml(item.connectionId)}</dd>
      <dt>Updated</dt><dd>${escapeHtml(item.updatedAt)}</dd>
    </dl>
    <div class="qr">${qrMarkup}</div>
    ${errorMarkup}
  </article>`;
};

const renderDashboardHtml = (options: {
  auth: string;
  enabled: boolean;
  initialItems: DashboardSessionItem[];
  tenantId?: string;
  connectionKey?: string;
}): string => {
  const tenantQuery = options.tenantId ? `&tenantId=${encodeURIComponent(options.tenantId)}` : "";
  const connectionQuery = options.connectionKey
    ? `&connectionKey=${encodeURIComponent(options.connectionKey)}`
    : "";
  const initialItemsMarkup = options.initialItems.map(renderDashboardCard).join("");
  const initialItemsJson = JSON.stringify(options.initialItems);
  const initialFeedback =
    options.initialItems.length > 0
      ? null
      : options.enabled
        ? "No hay sesiones Baileys activas para los filtros enviados."
        : "Baileys esta deshabilitado en esta instancia. Activa ENABLE_BAILEYS=true.";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baileys Login</title>
    <style>
      :root {
        --bg: #f3efe6;
        --panel: #fffaf1;
        --ink: #18211d;
        --muted: #58645f;
        --accent: #165d47;
        --warning: #9a6a11;
        --danger: #a3333d;
        --border: #d8cfbc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(22, 93, 71, 0.14), transparent 32%),
          linear-gradient(135deg, #f7f2e8, #ebe4d1);
        color: var(--ink);
      }
      .wrap {
        max-width: 1180px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .hero {
        display: grid;
        gap: 10px;
        margin-bottom: 28px;
      }
      .hero h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 46px);
        line-height: 0.95;
        letter-spacing: -0.03em;
      }
      .hero p {
        margin: 0;
        color: var(--muted);
        max-width: 760px;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 14px;
        color: var(--muted);
      }
      .chip {
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 250, 241, 0.78);
        border: 1px solid var(--border);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 18px;
      }
      .card {
        background: rgba(255, 250, 241, 0.88);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 18px;
        box-shadow: 0 12px 36px rgba(24, 33, 29, 0.08);
      }
      .card header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
        margin-bottom: 14px;
      }
      .card h2 {
        margin: 0;
        font-size: 20px;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .status.connected { background: rgba(22, 93, 71, 0.12); color: var(--accent); }
      .status.qr_ready { background: rgba(154, 106, 17, 0.14); color: var(--warning); }
      .status.connecting { background: rgba(24, 33, 29, 0.08); color: var(--muted); }
      .status.disconnected, .status.error, .status.disabled {
        background: rgba(163, 51, 61, 0.12);
        color: var(--danger);
      }
      dl {
        display: grid;
        grid-template-columns: minmax(110px, 120px) 1fr;
        gap: 8px 12px;
        margin: 0 0 18px;
        font-size: 14px;
      }
      dt { color: var(--muted); }
      dd { margin: 0; word-break: break-word; }
      .qr {
        min-height: 290px;
        display: grid;
        place-items: center;
        border: 1px dashed var(--border);
        border-radius: 18px;
        background: #fff;
        overflow: hidden;
      }
      .qr img {
        width: min(100%, 280px);
        height: auto;
      }
      .empty, .error {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: rgba(255, 250, 241, 0.88);
        color: var(--muted);
      }
      .error {
        border-color: rgba(163, 51, 61, 0.25);
        color: var(--danger);
      }
      @media (max-width: 640px) {
        .wrap { padding-inline: 14px; }
        .card { padding: 16px; border-radius: 18px; }
        dl { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>Baileys Login Console</h1>
        <p>Abre esta página desde el móvil o desde otra pantalla para escanear el QR de una sesión activa de WhatsApp. La vista se refresca automáticamente.</p>
        <div class="meta">
          <span class="chip">Protected by query param auth</span>
          <span class="chip">Auto refresh: 4s</span>
          <span class="chip">Path: /auth/baileys</span>
        </div>
      </section>
      <div id="feedback" class="${initialFeedback ? "empty" : "empty"}"${initialFeedback ? "" : " hidden"}>${escapeHtml(initialFeedback ?? "Cargando sesiones...")}</div>
      <section id="grid" class="grid"${options.initialItems.length > 0 ? "" : " hidden"}>${initialItemsMarkup}</section>
    </main>
    <script>
      const auth = ${JSON.stringify(options.auth)};
      const tenantId = ${JSON.stringify(options.tenantId ?? "")};
      const connectionKey = ${JSON.stringify(options.connectionKey ?? "")};
      const enabled = ${options.enabled ? "true" : "false"};
      const initialItems = ${initialItemsJson};
      const feedback = document.getElementById("feedback");
      const grid = document.getElementById("grid");

      const escapeHtml = (value) => String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

      const createCard = (item) => {
        const qrMarkup = item.qrCodeDataUrl
          ? '<img alt="Baileys QR" src="' + item.qrCodeDataUrl + '" />'
          : '<div style="padding:24px;text-align:center;color:#58645f;">' + escapeHtml(item.statusMessage) + '</div>';

        const errorMarkup = item.lastError
          ? '<div class="error" style="margin-top:14px;">' + escapeHtml(item.lastError) + '</div>'
          : '';

        return '<article class="card">' +
          '<header>' +
            '<div><h2>' + escapeHtml(item.displayName) + '</h2><div style="color:#58645f;font-size:14px;">' + escapeHtml(item.connectionKey) + '</div></div>' +
            '<span class="status ' + escapeHtml(item.status) + '">' + escapeHtml(item.statusLabel) + '</span>' +
          '</header>' +
          '<dl>' +
            '<dt>Tenant</dt><dd>' + escapeHtml(item.tenantId) + '</dd>' +
            '<dt>Connection</dt><dd>' + escapeHtml(item.connectionId) + '</dd>' +
            '<dt>Updated</dt><dd>' + escapeHtml(item.updatedAt) + '</dd>' +
          '</dl>' +
          '<div class="qr">' + qrMarkup + '</div>' +
          errorMarkup +
        '</article>';
      };

      const showFeedback = (className, message) => {
        grid.hidden = true;
        feedback.hidden = false;
        feedback.className = className;
        feedback.textContent = message;
      };

      const renderItems = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
          showFeedback(
            'empty',
            enabled
              ? 'No hay sesiones Baileys activas para los filtros enviados.'
              : 'Baileys está deshabilitado en esta instancia. Activa ENABLE_BAILEYS=true.'
          );
          return;
        }

        feedback.hidden = true;
        grid.hidden = false;
        grid.innerHTML = items.map(createCard).join('');
      };

      const render = async () => {
        const url = new URL('/auth/baileys/sessions', window.location.origin);
        url.searchParams.set('auth', auth);

        if (tenantId) {
          url.searchParams.set('tenantId', tenantId);
        }

        if (connectionKey) {
          url.searchParams.set('connectionKey', connectionKey);
        }

        try {
          const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
          const body = await response.json();

          if (!response.ok) {
            showFeedback('error', body?.error?.message ?? 'No se pudo cargar el dashboard.');
            return;
          }

          renderItems(body.items);
        } catch (error) {
          showFeedback(
            'error',
            error instanceof Error ? error.message : 'Error inesperado al cargar el dashboard.'
          );
        }
      };

      renderItems(initialItems);
      void render();
      setInterval(() => { void render(); }, 4000);
    </script>
  </body>
</html>`;
};

const assertDashboardAuth = (
  query: z.infer<typeof authQuerySchema>,
  dependencies: HttpRouteDependencies
): { tenantId?: string; connectionKey?: string } | { error: { statusCode: number; message: string } } => {
  if (!dependencies.baileysDashboardAuthToken) {
    return {
      error: {
        statusCode: 503,
        message: "Baileys dashboard auth token is not configured"
      }
    };
  }

  if (query.auth !== dependencies.baileysDashboardAuthToken) {
    return {
      error: {
        statusCode: 401,
        message: unauthorized.error.message
      }
    };
  }

  return {
    tenantId: query.tenantId,
    connectionKey: query.connectionKey
  };
};

export const registerBaileysAuthRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies
): void => {
  app.get("/auth/baileys", async (request, reply) => {
    const query = authQuerySchema.parse(request.query);
    const authState = assertDashboardAuth(query, dependencies);

    if ("error" in authState) {
      return reply.status(authState.error.statusCode).send({
        error: {
          code:
            authState.error.statusCode === 401 ? "unauthorized" : "baileys_dashboard_not_configured",
          message: authState.error.message
        }
      });
    }

    const sessions = await dependencies.baileysSessionView.listSessions({
      tenantId: authState.tenantId,
      connectionKey: authState.connectionKey
    });
    const initialItems = await buildDashboardSessionItems(sessions);

    return reply.type("text/html").send(
      renderDashboardHtml({
        auth: query.auth,
        enabled: dependencies.baileysSessionView.isEnabled(),
        initialItems,
        tenantId: authState.tenantId,
        connectionKey: authState.connectionKey
      })
    );
  });

  app.get("/auth/baileys/sessions", async (request, reply) => {
    const query = authQuerySchema.parse(request.query);
    const authState = assertDashboardAuth(query, dependencies);

    if ("error" in authState) {
      return reply.status(authState.error.statusCode).send({
        error: {
          code:
            authState.error.statusCode === 401 ? "unauthorized" : "baileys_dashboard_not_configured",
          message: authState.error.message
        }
      });
    }

    const sessions = await dependencies.baileysSessionView.listSessions({
      tenantId: authState.tenantId,
      connectionKey: authState.connectionKey
    });

    const items = await buildDashboardSessionItems(sessions);

    return reply.send({
      enabled: dependencies.baileysSessionView.isEnabled(),
      items
    });
  });
};
