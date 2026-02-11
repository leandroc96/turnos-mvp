/**
 * Lambda: ReminderChecker
 *
 * Ejecutada por EventBridge cada 30 minutos.
 * Busca turnos TENTATIVE cuyo startTime está entre 47h y 49h desde ahora
 * y que aún no recibieron recordatorio. Envía un mensaje de WhatsApp
 * (template) al paciente y marca reminderSent = true.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { sendTemplateMessage } from "../../shared/whatsapp/metaClient";
import { AppointmentStatus } from "../../../domain/appointment.model";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.APPOINTMENTS_TABLE_NAME || "Appointments";
const GSI_NAME = "status-startTime-index";

const WHATSAPP_TEMPLATE_NAME =
  process.env.WHATSAPP_TEMPLATE_NAME || "appointment_reminder";
const WHATSAPP_TEMPLATE_LANG =
  process.env.WHATSAPP_TEMPLATE_LANG || "es_AR";

// Ventana: entre 47h y 49h antes del turno (cubre la ejecución cada 30 min con margen)
const REMINDER_WINDOW_MIN_HOURS = 47;
const REMINDER_WINDOW_MAX_HOURS = 49;

/**
 * Formatea fecha ISO a texto legible en español.
 * Ej: "2026-02-13T10:30:00-03:00" → "viernes 13 de febrero"
 */
function formatDateSpanish(isoDate: string): string {
  const date = new Date(isoDate);
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

/**
 * Extrae la hora HH:mm de un ISO string.
 */
function formatTimeSpanish(isoDate: string): string {
  const date = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Normaliza un número de teléfono argentino a formato internacional sin +.
 * Ej: "011-1234-5678" → "5491112345678"
 *     "+5491112345678" → "5491112345678"
 *     "1112345678"     → "5491112345678"
 */
function normalizePhoneAR(phone: string): string {
  // Quitar todo excepto dígitos
  let digits = phone.replace(/\D/g, "");

  // Si empieza con 54, ya está en formato internacional
  if (digits.startsWith("54")) {
    return digits;
  }

  // Si empieza con 0 (prefijo local argentino), quitarlo
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  // Si empieza con 15 (celular argentino), reemplazar por 9 + código de área
  // Asumimos Buenos Aires (11) si no hay código de área
  if (digits.startsWith("15")) {
    digits = "11" + digits.substring(2);
  }

  // Agregar prefijo 549 (Argentina celular)
  return `549${digits}`;
}

export const handler = async (): Promise<void> => {
  console.log("=== REMINDER CHECKER START ===");

  const now = new Date();
  const windowStart = new Date(
    now.getTime() + REMINDER_WINDOW_MIN_HOURS * 60 * 60 * 1000
  );
  const windowEnd = new Date(
    now.getTime() + REMINDER_WINDOW_MAX_HOURS * 60 * 60 * 1000
  );

  console.log("Buscando turnos TENTATIVE entre:", {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  try {
    // Consultar GSI: status = TENTATIVE, startTime entre windowStart y windowEnd
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression:
          "#status = :status AND #startTime BETWEEN :from AND :to",
        FilterExpression: "attribute_not_exists(reminderSent) OR reminderSent = :false",
        ExpressionAttributeNames: {
          "#status": "status",
          "#startTime": "startTime",
        },
        ExpressionAttributeValues: {
          ":status": AppointmentStatus.TENTATIVE,
          ":from": windowStart.toISOString(),
          ":to": windowEnd.toISOString(),
          ":false": false,
        },
      })
    );

    const appointments = result.Items || [];
    console.log(`Encontrados ${appointments.length} turnos para recordar`);

    for (const appt of appointments) {
      // Validar que tenga teléfono
      if (!appt.patientPhone) {
        console.warn(
          `Turno ${appt.appointmentId} sin teléfono, saltando`
        );
        continue;
      }

      const phone = normalizePhoneAR(appt.patientPhone);
      const patientName = appt.patientName || "paciente";
      const dateText = formatDateSpanish(appt.startTime);
      const timeText = formatTimeSpanish(appt.startTime);

      console.log(`Enviando recordatorio a ${phone} para turno ${appt.appointmentId}`);

      try {
        await sendTemplateMessage(
          phone,
          WHATSAPP_TEMPLATE_NAME,
          WHATSAPP_TEMPLATE_LANG,
          [patientName, dateText, timeText]
        );

        // Marcar como enviado
        await dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { appointmentId: appt.appointmentId },
            UpdateExpression:
              "SET reminderSent = :true, reminderSentAt = :now",
            ExpressionAttributeValues: {
              ":true": true,
              ":now": new Date().toISOString(),
            },
          })
        );

        console.log(`✅ Recordatorio enviado para turno ${appt.appointmentId}`);
      } catch (err: any) {
        console.error(
          `❌ Error enviando recordatorio para turno ${appt.appointmentId}:`,
          err.message
        );
        // Continuar con el siguiente turno
      }
    }

    console.log("=== REMINDER CHECKER END ===");
  } catch (error: any) {
    console.error("Error en ReminderChecker:", error.message);
    throw error;
  }
};
