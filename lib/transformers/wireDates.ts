/** Dates arrive as ISO strings over HTTP and as Date objects inside Prisma. */
export type WireDates<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] extends Date ? Date | string : Date | string | null;
};

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
