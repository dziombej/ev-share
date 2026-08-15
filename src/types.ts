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

export interface ChargingSession {
  id: string;
  pocId: string;
  hostId: string;
  hostEmail: string;
  seekerId: string;
  seekerEmail: string;
  kwh: number;
  createdAt: string;
  poc: Pick<Poc, "id" | "latitude" | "longitude" | "powerRatingKw">;
}

export interface LogSessionInput {
  pocId: string;
  seekerEmail: string;
  kwh: number;
}
