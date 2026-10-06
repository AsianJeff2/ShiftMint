import path from 'node:path';
import { closeDatabase, createDatabaseBackup, getPrismaClient } from '../electron/backend/database';
import { decrypt, encrypt, isEncrypted } from '../lib/security/encryption';

/** Offline migration: normal contact/address fields remain readable by the current API. */
async function migrate(): Promise<void> {
  if (!process.env.DATABASE_URL?.startsWith('file:') || !process.env.SHIFTMINT_DATA_DIR || !path.isAbsolute(process.env.SHIFTMINT_DATA_DIR)) {
    throw new Error('Set an explicit SQLite DATABASE_URL and absolute SHIFTMINT_DATA_DIR. Stop ShiftMint before applying this offline migration.');
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) throw new Error('Supply the original workspace ENCRYPTION_KEY (64 hex characters).');
  const prisma = getPrismaClient();
  try {
    const employees = await prisma.employee.findMany({ select: { id: true, bankAccountNumber: true, bankRoutingNumber: true } });
    const businesses = await prisma.business.findMany({ select: { id: true, ein: true } });
    const protect = (value: string | null) => {
      if (!value) return value;
      if (isEncrypted(value)) { decrypt(value); return value; }
      return encrypt(value);
    };
    const employeeUpdates = employees.map(employee => ({ id: employee.id, data: { bankAccountNumber: protect(employee.bankAccountNumber), bankRoutingNumber: protect(employee.bankRoutingNumber) } })).filter((update, index) => update.data.bankAccountNumber !== employees[index].bankAccountNumber || update.data.bankRoutingNumber !== employees[index].bankRoutingNumber);
    const businessUpdates = businesses.map(business => ({ id: business.id, ein: protect(business.ein) })).filter((update, index) => update.ein !== businesses[index].ein);
    console.log(`Sensitive fields requiring encryption: ${employeeUpdates.length} employees, ${businessUpdates.length} businesses.`);
    if (!process.argv.includes('--apply')) { console.log('Dry run only. Stop the application, retain the original key and rerun with --apply to write.'); return; }
    if (!employeeUpdates.length && !businessUpdates.length) { console.log('No changes required.'); return; }
    await createDatabaseBackup(`pre-encryption-${Date.now()}.db`);
    await prisma.$transaction(async transaction => {
      for (const update of employeeUpdates) await transaction.employee.update({ where: { id: update.id }, data: update.data });
      for (const update of businessUpdates) await transaction.business.update({ where: { id: update.id }, data: { ein: update.ein } });
    });
    console.log('Encryption migration completed atomically. Retain the safety backup and original key.');
  } finally { await closeDatabase(); }
}

migrate().catch(error => { console.error(error instanceof Error ? error.message : 'Encryption migration failed'); process.exitCode = 1; });
