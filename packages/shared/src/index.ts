export type PropertyPurpose = "sale" | "rent";
export type PropertyZone = "urban" | "rural";
export type PropertyStatus = "available" | "reserved" | "rented" | "sold" | "inactive";

export interface BrokerSummary {
  id: string;
  name: string;
  whatsapp?: string | null;
  creci?: string | null;
}

export interface PropertySummary {
  id: string;
  code: string;
  title: string;
  purpose: PropertyPurpose;
  zone: PropertyZone;
  status: PropertyStatus;
  price: number;
  city: string;
  neighborhood?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  coverPhotoUrl?: string | null;
  broker?: BrokerSummary | null;
}

export type SyncState =
  | "saved_local"
  | "waiting_network"
  | "syncing"
  | "synced"
  | "sync_error";
