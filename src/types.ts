export interface Poc {
  id: string;
  ownerId: string;
  latitude: number;
  longitude: number;
  powerRatingKw: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePocInput {
  latitude: number;
  longitude: number;
  powerRatingKw: number;
}
