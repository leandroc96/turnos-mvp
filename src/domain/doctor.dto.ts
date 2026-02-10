export interface CreateDoctorDto {
  name: string;
  specialty?: string;
}

export interface UpdateDoctorDto {
  name?: string;
  specialty?: string;
  active?: boolean;
}

export interface DoctorResponseDto {
  doctorId: string;
  name: string;
  specialty?: string;
  active: boolean;
}
