import { google, calendar_v3 } from "googleapis";
import { loadServiceAccount } from "./serviceAccountSecret";

let cachedCalendar: calendar_v3.Calendar | null = null;

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (cachedCalendar) return cachedCalendar;

  const secretName = process.env.GOOGLE_SECRET_NAME!;
  const impersonate = process.env.GOOGLE_IMPERSONATE_USER;

  const sa = await loadServiceAccount(secretName);

  // Validar que el service account tiene los campos necesarios
  if (!sa.client_email) {
    throw new Error("Service account JSON no tiene 'client_email'");
  }
  if (!sa.private_key) {
    throw new Error(
      "Service account JSON no tiene 'private_key'. Verifica que el secret en AWS Secrets Manager tenga el JSON completo del service account."
    );
  }

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonate,
  });

  cachedCalendar = google.calendar({
    version: "v3",
    auth,
  });

  return cachedCalendar;
}
