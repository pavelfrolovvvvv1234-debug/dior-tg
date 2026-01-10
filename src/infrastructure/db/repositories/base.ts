/**
 * Base repository with common functionality.
 *
 * @module infrastructure/db/repositories/base
 */

import { DataSource, Repository, EntityTarget } from "typeorm";

/**
 * Base repository class with common CRUD operations.
 */
export abstract class BaseRepository<T> {
  protected repository: Repository<T>;

  constructor(
    protected dataSource: DataSource,
    protected entity: EntityTarget<T>
  ) {
    this.repository = dataSource.getRepository(entity);
  }

  /**
   * Find entity by ID.
   */
  async findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as Partial<T>,
    });
  }

  /**
   * Find all entities.
   */
  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  /**
   * Save entity.
   */
  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  /**
   * Delete entity by ID.
   */
  async deleteById(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Count entities.
   */
  async count(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Get the underlying TypeORM repository for advanced queries.
   */
  getRepository(): Repository<T> {
    return this.repository;
  }
}
