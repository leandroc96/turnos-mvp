/**
 * Lambda: WhatsApp Webhook
 *
 * Maneja dos tipos de requests:
 * - GET  → Verificación del webhook (Meta envía un challenge)
 * - POST → Mensajes entrantes de WhatsApp (respuestas del paciente)
 *
 * Cuando el paciente responde al recordatorio, actualizamos
 * el status del turno en DynamoDB y en Google Calendar.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { sendTextMessage } from "../../shared/whatsapp/metaClient";
import { AppointmentStatus } from "../../../domain/appointment.model";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.APPOINTMENTS_TABLE_NAME || "Appointments";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "turnos-mvp-verify";

/**
 * Extrae los dígitos de un teléfono para buscar en DynamoDB.
 */
function extractDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Busca el turno TENTATIVE más próximo de un número de teléfono.
 * Usa Scan con filtro (aceptable para MVP con bajo volumen).
 */
async function findPendingAppointmentByPhone(
  phone: string
): Promise<any | null> {
  const digits = extractDigits(phone);

  // Para MVP usamos Scan con filtro. A escala se debería usar un GSI por teléfono.
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression:
        "#status = :tentative AND reminderSent = :true",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":tentative": AppointmentStatus.TENTATIVE,
        ":true": true,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) return null;

  // Filtrar por teléfono (comparar dígitos)
  const matching = result.Items.filter((item) => {
    const itemDigits = extractDigits(item.patientPhone || "");
    // Comparar últimos 10 dígitos (sin código de país)
    return (
      itemDigits.endsWith(digits.slice(-10)) ||
      digits.endsWith(itemDigits.slice(-10))
    );
  });

  if (matching.length === 0) return null;

  // Devolver el más próximo en el tiempo
  matching.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return matching[0];
}

/**
 * Actualiza el status del turno.
 */
async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<void> {
  const now = new Date().toISOString();
  const updateField =
    newStatus === AppointmentStatus.CONFIRMED ? "confirmedAt" : "cancelledAt";

  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { appointmentId },
      UpdateExpression: `SET #status = :status, ${updateField} = :now`,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": newStatus,
        ":now": now,
      },
    })
  );
}

/**
 * Determina la intención del usuario a partir de su mensaje.
 */
function parseIntent(
  text: string
): "confirm" | "cancel" | "unknown" {
  const lower = text.toLowerCase().trim();

  const confirmWords = [
    "confirmar", "confirmo", "si", "sí", "ok", "dale", "listo", "voy",
    "asisto", "confirmar turno", "1",
  ];
  const cancelWords = [
    "cancelar", "cancelo", "no", "no puedo", "no voy", "anular", "2",
  ];

  if (confirmWords.some((w) => lower.includes(w))) return "confirm";
  if (cancelWords.some((w) => lower.includes(w))) return "cancel";
  return "unknown";
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("WhatsApp Webhook event:", JSON.stringify(event, null, 2));

  // ─── GET: Verificación del webhook ───
  if (event.httpMethod === "GET") {
    const mode = event.queryStringParameters?.["hub.mode"];
    const token = event.queryStringParameters?.["hub.verify_token"];
    const challenge = event.queryStringParameters?.["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado correctamente");
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: challenge || "",
      };
    }

    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Verification failed" }),
    };
  }

  // ─── POST: Mensajes entrantes ───
  try {
    const body = JSON.parse(event.body || "{}");

    // Meta envía la estructura: body.entry[].changes[].value.messages[]
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Meta también envía status updates (delivered, read), los ignoramos
    if (!value?.messages || value.messages.length === 0) {
      console.log("No hay mensajes nuevos (probablemente status update)");
      return { statusCode: 200, body: "OK" };
    }

    for (const message of value.messages) {
      const from = message.from; // Número del remitente (ej: "5491112345678")
      const messageType = message.type;

      let text = "";

      if (messageType === "text") {
        text = message.text?.body || "";
      } else if (messageType === "interactive") {
        // Respuesta de botón
        text =
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          "";
      } else {
        console.log(`Tipo de mensaje no soportado: ${messageType}`);
        continue;
      }

      console.log(`Mensaje de ${from}: "${text}"`);

      // Buscar turno pendiente del paciente
      const appointment = await findPendingAppointmentByPhone(from);

      if (!appointment) {
        console.log(`No se encontró turno pendiente para ${from}`);
        await sendTextMessage(
          from,
          "No encontramos un turno pendiente de confirmar asociado a tu número. Si tenés alguna consulta, contactanos directamente."
        );
        continue;
      }

      const intent = parseIntent(text);

      if (intent === "confirm") {
        await updateAppointmentStatus(
          appointment.appointmentId,
          AppointmentStatus.CONFIRMED
        );
        await sendTextMessage(
          from,
          `✅ ¡Tu turno fue confirmado! Te esperamos el ${new Date(appointment.startTime).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} a las ${new Date(appointment.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}. ¡Gracias!`
        );
        console.log(`Turno ${appointment.appointmentId} CONFIRMADO`);
      } else if (intent === "cancel") {
        await updateAppointmentStatus(
          appointment.appointmentId,
          AppointmentStatus.CANCELLED
        );
        await sendTextMessage(
          from,
          "❌ Tu turno fue cancelado. Si necesitás reprogramar, contactanos. ¡Gracias!"
        );
        console.log(`Turno ${appointment.appointmentId} CANCELADO`);
      } else {
        await sendTextMessage(
          from,
          'No pudimos entender tu respuesta. Por favor respondé "Confirmar" o "Cancelar".'
        );
      }
    }

    return { statusCode: 200, body: "OK" };
  } catch (error: any) {
    console.error("Error procesando webhook:", error.message);
    // Siempre devolver 200 a Meta para evitar reintentos
    return { statusCode: 200, body: "OK" };
  }
};
