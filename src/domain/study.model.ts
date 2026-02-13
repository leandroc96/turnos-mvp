export interface Study {
  studyId: string;
  name: string;
  description?: string;
  durationMinutes: number; // Por si en el futuro varía por estudio
  honorario: number; // Honorario médico fijo por estudio (default 0)
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
