import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getCalendarClient } from "../../shared/google/calendarClient";
import {
  CreateAppointmentDto,
  Appointment,
  AppointmentStatus,
  AppointmentResponseDto,
} from "../../../domain/appointment";
import { successResponse, errorResponse, parseRequestBody } from "../../../utils/http";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.APPOINTMENTS_TABLE_NAME!;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

/** Duración del turno en minutos (por ahora siempre 30) */
const APPOINTMENT_DURATION_MINUTES = 30;

/**
 * Calcula endTime como startTime + duración fija (media hora).
 * Devuelve ISO con offset -03:00 (Argentina).
 */
function endTimeFromStart(startTimeISO: string): string {
  const start = new Date(startTimeISO);
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000);
  const ar = new Date(end.getTime() + 3 * 60 * 60 * 1000); // componentes en hora Argentina
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ar.getUTCFullYear()}-${pad(ar.getUTCMonth() + 1)}-${pad(ar.getUTCDate())}T${pad(ar.getUTCHours())}:${pad(ar.getUTCMinutes())}:${pad(ar.getUTCSeconds())}-03:00`;
}

/**
 * Valida si un string es un email válido
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Regex básico para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log("=== CREATE APPOINTMENT HANDLER START ===");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Environment variables:", {
    TABLE_NAME: process.env.APPOINTMENTS_TABLE_NAME,
    CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    SECRET_NAME: process.env.GOOGLE_SECRET_NAME,
    IMPERSONATE_USER: process.env.GOOGLE_IMPERSONATE_USER,
  });

  try {
    // Parsear y validar request body (DTO)
    console.log("Parsing request body...");
    const body = parseRequestBody(event.body);
    console.log("Parsed body:", JSON.stringify(body, null, 2));
    
    const dto: CreateAppointmentDto = body;
    
    // Determinar si es formato Google Form o formato original
    const isGoogleForm = dto.source === "google_form" || (dto.date && dto.time);
    
    let patientName: string;
    let patientPhone: string;
    let startTime: string;
    let endTime: string;
    let description: string | undefined;
    
    if (isGoogleForm) {
      // Formato Google Form: date + time → startTime/endTime
      patientName = dto.patientName;
      patientPhone = dto.phone || dto.patientPhone || "";
      
      // Convertir date + time a startTime; endTime siempre startTime + 30 min
      const dateStr = dto.date!; // YYYY-MM-DD
      const timeStr = dto.time!; // HH:mm
      startTime = `${dateStr}T${timeStr}:00-03:00`; // Timezone Argentina
      endTime = endTimeFromStart(startTime);
      
      // Construir descripción con los campos adicionales
      const descriptionParts: string[] = [];
      if (dto.study) descriptionParts.push(`Estudio: ${dto.study}`);
      if (dto.insurance) descriptionParts.push(`Obra social: ${dto.insurance}`);
      if (dto.doctorId) descriptionParts.push(`Doctor ID: ${dto.doctorId}`);
      if (dto.email) descriptionParts.push(`Email: ${dto.email}`);
      description = descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined;
      
      console.log("Formato Google Form detectado:", {
        date: dto.date,
        time: dto.time,
        startTime,
        endTime,
      });
    } else {
      // Formato original: solo startTime; endTime = startTime + 30 min
      patientName = dto.patientName;
      patientPhone = dto.patientPhone || "";
      startTime = dto.startTime!;
      endTime = endTimeFromStart(startTime);
      description = dto.description;
    }

    // Validar campos requeridos
    if (!patientName || !startTime) {
      return errorResponse(
        "Missing required fields: patientName, startTime (o date + time para formato Google Form)",
        400
      );
    }

    // Generar ID único para el turno
    const appointmentId = uuidv4();
    console.log("Generated appointmentId:", appointmentId);

    // Crear evento en Google Calendar
    console.log("Getting Google Calendar client...");
    const calendar = await getCalendarClient();
    console.log("Calendar client obtained, creating event...");
    
    // Preparar el request body del evento
    const eventBody: any = {
      summary: `Turno: ${patientName}`,
      description: description || `Turno médico para ${patientName}`,
      start: {
        dateTime: startTime,
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: endTime,
        timeZone: "America/Argentina/Buenos_Aires",
      },
      status: "tentative", // Evento tentativo hasta confirmación
    };

    // Agregar attendees si hay email disponible y válido
    const attendeeEmail = isGoogleForm ? dto.email : (patientPhone.includes("@") ? patientPhone : undefined);
    if (attendeeEmail && isValidEmail(attendeeEmail)) {
      eventBody.attendees = [
        {
          email: attendeeEmail,
          displayName: patientName,
        },
      ];
      console.log("Added attendee with email:", attendeeEmail);
    } else if (attendeeEmail) {
      console.log("Email provided but invalid, skipping attendee:", attendeeEmail);
    }

    const calendarEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: eventBody,
    });

    const calendarEventId = calendarEvent.data.id!;
    const calendarLink = calendarEvent.data.htmlLink || undefined;
    console.log("Calendar event created:", { calendarEventId, calendarLink });

    // Calcular TTL (expiración) - 30 días después del turno
    const startTimeDate = new Date(startTime);
    const expiresAt = Math.floor(startTimeDate.getTime() / 1000) + 30 * 24 * 60 * 60; // 30 días en segundos
    console.log("Calculated TTL:", { expiresAt, startTime });

    // Crear objeto Appointment (modelo de dominio)
    console.log("Creating appointment object...");
    const appointment: Appointment = {
      appointmentId,
      patientName,
      patientPhone,
      startTime,
      endTime,
      description,
      calendarEventId,
      status: AppointmentStatus.TENTATIVE,
      createdAt: new Date().toISOString(),
      expiresAt,
      // Campos adicionales del Google Form
      ...(isGoogleForm && {
        email: dto.email,
        study: dto.study,
        insurance: dto.insurance,
        doctorId: dto.doctorId,
        source: dto.source || "google_form",
      }),
    };

    // Guardar en DynamoDB
    console.log("Saving to DynamoDB...", { tableName: TABLE_NAME });
    await dynamoClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: appointment,
      })
    );
    console.log("Saved to DynamoDB successfully");

    // Respuesta exitosa (DTO)
    console.log("Creating response...");
    const response: AppointmentResponseDto = {
      appointmentId,
      calendarEventId,
      status: AppointmentStatus.TENTATIVE,
      ...(calendarLink && { calendarLink }),
    };

    console.log("=== CREATE APPOINTMENT HANDLER SUCCESS ===");
    return successResponse(response, 201);
  } catch (error: any) {
    console.error("=== CREATE APPOINTMENT HANDLER ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return errorResponse("Failed to create appointment", 500, error.message);
  }
};
