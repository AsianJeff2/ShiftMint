/**
 * Base repository interface
 * All repositories extend this for common CRUD operations
 */
export interface IRepository<T, TCreate, TUpdate = Partial<TCreate>> {
  /**
   * Find entity by ID
   * @param id - Entity ID (string for cuid-based IDs)
   * @param businessId - Business ID for multi-tenancy (string for cuid)
   * @returns Entity or null if not found
   */
  findById(id: string, businessId: string): Promise<T | null>;

  /**
   * Find all entities for a business
   * @param businessId - Business ID (string for cuid)
   * @returns Array of entities
   */
  findAll(businessId: string): Promise<T[]>;

  /**
   * Create new entity
   * @param data - Entity creation data
   * @param businessId - Business ID (string for cuid)
   * @returns Created entity
   */
  create(data: TCreate, businessId: string): Promise<T>;

  /**
   * Update existing entity
   * @param id - Entity ID (string for cuid-based IDs)
   * @param data - Partial entity data to update
   * @param businessId - Business ID (string for cuid)
   * @returns Updated entity
   */
  update(id: string, data: TUpdate, businessId: string): Promise<T>;

  /**
   * Delete entity
   * @param id - Entity ID (string for cuid-based IDs)
   * @param businessId - Business ID (string for cuid)
   */
  delete(id: string, businessId: string): Promise<void>;
}
