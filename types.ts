export interface Blueprint {
  category: string;
  brand: string;
  id: number;
}

export interface UploadFormData {
  printifyKey: string;
  etsyKeystring: string;
  etsySharedSecret: string;
  file: File | null;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface ServerResponse {
  success: boolean;
  message: string;
  data?: {
    blueprintId: number;
    productType: string;
    listingTitle: string;
    mockupsUploaded: number;
  };
}

export interface ProgressEvent {
  type: 'upload' | 'server_progress' | 'complete' | 'error';
  percent: number; // 0-100
  message: string;
  data?: any;
}

export type OnProgressCallback = (event: ProgressEvent) => void;

export const PRINTIFY_BLUEPRINTS: Blueprint[] = [
  { category: 'T-SHIRT', brand: 'Bella+Canvas 3001', id: 6 },
  { category: 'T-SHIRT', brand: 'Next Level 3600', id: 3 },
  { category: 'SWEATSHIRT', brand: 'Gildan 18000', id: 5 },
  { category: 'HOODIE', brand: 'Gildan 18500', id: 384 },
  { category: 'HOODIE', brand: 'Champion S700', id: 9 },
  { category: 'HOODIE', brand: 'Lane Seven 14001', id: 1098 },
  { category: 'HOODIE', brand: 'Independent Trading Co. SS4500', id: 462 },
];