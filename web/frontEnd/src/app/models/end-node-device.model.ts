// models/end-node-device.model.ts
export interface EndNodeDevice {
  id?: string;

  devEui: string;
  name?: string;
  description?: string;

  // From Organization (auto-filled on create)
  address?: string;

  // Timestamps from chirpstack
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;

  // Ownership / relations
  organizationId: string;
  userId: string;

  // GPS (filled from latest SensorReading)
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
}
