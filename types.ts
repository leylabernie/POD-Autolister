
export interface Blueprint {
  id: number;
  title: string;
  brand: string;
  model: string;
  images: string[];
}

export interface BlueprintMapping {
  keyword: string;
  blueprintId: number;
}

export interface UploadFormData {
  printifyKey: string;
  storeId: string;
  etsyKeystring: string;     
  etsySharedSecret: string;
  file: File | null;
  blueprintMappings: BlueprintMapping[];
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
    blueprintTitle?: string;
    blueprintBrand?: string;
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
