export interface Study {
  studyId: string;
  name: string;
  description?: string;
  durationMinutes: number; // Por si en el futuro varía por estudio
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
