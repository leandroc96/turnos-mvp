/**
 * DTOs (Data Transfer Objects) para Turnos
 * Objetos para transferir datos entre capas (API, Lambda, etc.)
 */

import { AppointmentStatus } from "./appointment.model";

/**
 * DTO para crear un turno (request)
 * Soporta dos formatos:
 * - Formato original: patientName, patientPhone, startTime, endTime, description
 * - Formato Google Form: patientName, phone, email, study, insurance, doctorId, date, time, source
 */
export interface CreateAppointmentDto {
  // Formato original
  patientName: string;
  patientPhone?: string;
  startTime?: string; // ISO 8601 datetime
  endTime?: string; // ISO 8601 datetime
  description?: string;
  
  // Formato Google Form
  phone?: string;
  email?: string;
  study?: string;
  insurance?: string;
  doctorId?: string;
  date?: string; // Fecha en formato YYYY-MM-DD
  time?: string; // Hora en formato HH:mm
  source?: string; // "google_form" u otro
}

/**
 * DTO para respuesta de creación de turno
 */
export interface AppointmentResponseDto {
  appointmentId: string;
  calendarEventId: string;
  status: AppointmentStatus;
  calendarLink?: string;
}

/**
 * DTO para respuesta de confirmación/cancelación
 */
export interface UpdateAppointmentResponseDto {
  appointmentId: string;
  status: AppointmentStatus;
  message: string;
}
