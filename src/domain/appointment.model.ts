/**
 * Modelo de dominio: Appointment
 * Objeto plano que representa un turno (sin lógica de negocio)
 * La lógica de negocio está en los handlers de las lambdas
 */

export enum AppointmentStatus {
  TENTATIVE = "TENTATIVE", // Creado pero no confirmado
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}

export interface Appointment {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  startTime: string;
  endTime: string;
  description?: string;
  // Campos adicionales del Google Form
  email?: string;
  study?: string;
  insurance?: string;
  doctorId?: string;
  source?: string;
  calendarEventId: string;
  status: AppointmentStatus;
  createdAt: string;
  expiresAt?: number;
  // Campos para recordatorio WhatsApp
  reminderSent?: boolean;
  reminderSentAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
}
