import { encrypt } from '../../../lib/security/encryption';

/** Routine API responses never contain bank credentials, even for owners. */
export function employeeResponse<T extends { bankAccountNumber?: string | null; bankRoutingNumber?: string | null }>(employee: T): T {
  return { ...employee, bankAccountNumber: undefined, bankRoutingNumber: undefined };
}

export function encryptedBankFields<T extends { bankAccountNumber?: string | null; bankRoutingNumber?: string | null }>(data: T): T {
  return {
    ...data,
    ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: encrypt(data.bankAccountNumber) } : {}),
    ...(data.bankRoutingNumber !== undefined ? { bankRoutingNumber: encrypt(data.bankRoutingNumber) } : {}),
  };
}

export function businessResponse<T extends { ein?: string | null }>(business: T): T & { einStored: boolean } {
  return { ...business, ein: undefined, einStored: Boolean(business.ein) };
}

export function encryptedEin(value: string | null | undefined): string | null { return encrypt(value); }
