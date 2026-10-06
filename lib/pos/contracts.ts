export type PosProvider = 'square' | 'toast';
export type PosEnvironment = 'production' | 'sandbox';

export type PosConnectInput =
  | { provider: 'square'; environment: PosEnvironment; accessToken: string; locationIds?: string[] }
  | { provider: 'toast'; clientId: string; clientSecret: string; locationIds: string[]; currency: 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AUD' };

export interface PosLocation {
  id: string;
  name: string;
  currency: string;
  timeZone?: string;
}

export interface PosConnection {
  provider: PosProvider;
  environment: PosEnvironment;
  status: 'validated' | 'needs_attention';
  locations: PosLocation[];
  validatedAt: string;
  warnings: string[];
}

export interface PosPreviewInput {
  startDate: string;
  endDate: string;
  includeLabor?: boolean;
  includeCatalog?: boolean;
}

export interface PosSale {
  id: string;
  locationId: string;
  orderId?: string;
  employeeId?: string;
  occurredAt: string;
  currency: string;
  amountMinor: number;
  tipMinor: number;
  refundedMinor: number;
  status: string;
  refundStatus?: string;
}

export interface PosLaborEntry {
  id: string;
  locationId: string;
  employeeId: string;
  startedAt: string;
  endedAt?: string;
  declaredCashTipMinor: number;
  nonCashTipMinor?: number;
  currency: string;
  deleted: boolean;
}

export interface PosCatalogItem {
  id: string;
  locationId?: string;
  name: string;
}

export interface PosPreview {
  provider: PosProvider;
  startDate: string;
  endDate: string;
  fetchedAt: string;
  sales: PosSale[];
  labor: PosLaborEntry[];
  catalog: PosCatalogItem[];
  warnings: string[];
  previewOnly: true;
}
