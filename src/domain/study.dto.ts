export interface CreateStudyDto {
  name: string;
  description?: string;
  durationMinutes?: number; // Default: 30
  honorario?: number; // Default: 0
}

export interface UpdateStudyDto {
  name?: string;
  description?: string;
  durationMinutes?: number;
  honorario?: number;
  active?: boolean;
}

export interface StudyResponseDto {
  studyId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  honorario: number;
  active: boolean;
}
