/**
 * Cliente para Meta WhatsApp Cloud API
 * Envía mensajes de template y texto vía la Graph API de Meta.
 *
 * Requiere en env:
 *   WHATSAPP_ACCESS_TOKEN   – Token permanente (System User)
 *   WHATSAPP_PHONE_NUMBER_ID – ID del número de WhatsApp Business
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_API_VERSION = "v21.0";

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

function getConfig(): WhatsAppConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "Faltan variables de entorno: WHATSAPP_ACCESS_TOKEN y/o WHATSAPP_PHONE_NUMBER_ID"
    );
  }

  return { accessToken, phoneNumberId };
}

function buildUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

/**
 * Envía un mensaje de template de WhatsApp (obligatorio para mensajes proactivos).
 *
 * @param to       – Número destino en formato internacional sin + (ej: "5491112345678")
 * @param template – Nombre del template aprobado en Meta
 * @param lang     – Código de idioma (ej: "es_AR")
 * @param bodyParams – Parámetros del body del template ({{1}}, {{2}}, etc.)
 */
export async function sendTemplateMessage(
  to: string,
  template: string,
  lang: string,
  bodyParams: string[]
): Promise<any> {
  const { accessToken, phoneNumberId } = getConfig();

  const body: any = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: lang },
      components: [],
    },
  };

  // Agregar parámetros del body si existen
  if (bodyParams.length > 0) {
    body.template.components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  const response = await fetch(buildUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error de Meta WhatsApp API:", JSON.stringify(data));
    throw new Error(
      `WhatsApp API error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  console.log("Mensaje WhatsApp enviado:", JSON.stringify(data));
  return data;
}

/**
 * Envía un mensaje de texto simple (solo funciona dentro de ventana de 24h).
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<any> {
  const { accessToken, phoneNumberId } = getConfig();

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const response = await fetch(buildUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error de Meta WhatsApp API:", JSON.stringify(data));
    throw new Error(
      `WhatsApp API error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}
