export interface Doctor {
  doctorId: string;
  name: string;
  specialty?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
