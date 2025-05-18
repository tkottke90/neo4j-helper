/**
 * Defines the possible directions for a relationship between nodes
 * - 'from': Relationship goes from source to target (source -> target)
 * - 'to': Relationship goes from target to source (source <- target)
 * - 'both': Bidirectional relationship (source <-> target)
 * - 'none': Undirected relationship (source - target)
 */
export type RelationshipDirections = 'from' | 'to' | 'both' | 'none';

export interface QueryOptions<Session, Transaction> {
  session?: Session;
  transaction?: Transaction;
}

export interface TransactionInput {
  query: string;
  params: Record<string, unknown>;
}

/**
 * Interface for defining query parameters when selecting data from a database
 * @template T - The type of object being queried
 */
export interface QueryInterface<T> {
  /**
   * Optional filter conditions for the query
   * Keys are property names of T, values are the conditions to match
   */
  where?: Record<keyof T, unknown>;
  join?: Record<string, RelationshipDirections>;
}

/**
 * Abstract Database class that defines the standard interface for database operations
 *
 * This class provides a consistent API for different database implementations,
 * allowing for interchangeable database backends while maintaining the same interface.
 * Implementations should handle the specific database connection and query logic.
 */
export abstract class Database<
  Session = unknown,
  Transaction = unknown,
  Options = QueryOptions<Session, Transaction>
> {
  /**
   * Disconnect from the database
   * @returns A promise that resolves when the connection is successfully closed
   */
  abstract disconnect(): Promise<void>;

  /**
   * Delete a record from the specified table by its ID
   * @template Key - The type of the ID field (defaults to number)
   * @param table - The name of the table to delete from
   * @param id - The unique identifier of the record to delete
   * @returns A promise that resolves to true if deletion was successful, false otherwise
   */
  abstract delete<Key = number>(table: string, id: Key): Promise<boolean>;

  /**
   * Insert a new record into the specified table
   * @template T - The type of the data object being inserted
   * @param table - The name of the table to insert into
   * @param data - The data object to insert
   * @returns A promise that resolves to the inserted data, potentially with additional fields (like ID)
   */
  abstract insert<T extends object = object>(
    table: string,
    data: object,
    options?: Options
  ): Promise<T>;

  /**
   * Create a relationship between two nodes
   * @param relationshipLabel - The label for the relationship
   * @param source - The ID of the source node
   * @param target - The ID of the target node
   * @param direction - The direction of the relationship
   * @returns A promise that resolves to true if the relationship was created successfully
   */
  abstract join(
    relationshipLabel: string,
    source: number,
    target: number,
    direction?: RelationshipDirections,
    options?: Options
  ): Promise<boolean>;

  /**
   * Select a record from the specified table based on query parameters
   * @template T - The type of object to be returned
   * @param table - The name of the table to select from
   * @param query - The query parameters to filter results
   * @returns A promise that resolves to the matching record
   */
  abstract select<T extends object = object>(
    table: string,
    query: QueryInterface<T>,
    options?: Options
  ): Promise<T[]>;

  /**
   * Update an existing record in the specified table
   * @template T - The type of the data object being updated
   * @template Key - The type of the ID field (defaults to number)
   * @param table - The name of the table to update
   * @param id - The unique identifier of the record to update
   * @param data - The data to update with
   * @returns A promise that resolves to the updated record
   */
  abstract update<T extends object = object, Key = number>(
    table: string,
    id: Key,
    data: object,
    options?: Options
  ): Promise<T>;

  /**
   * Insert a record if it doesn't exist, or update it if it does
   * @template T - The type of the data object being added/updated
   * @param table - The name of the table to upsert into
   * @param id - The unique identifier to check for existence
   * @param data - The data to insert or update
   * @returns A promise that resolves to the added/updated record
   */
  abstract upsert<T = unknown>(
    table: string,
    id: number,
    data: object,
    options?: Options
  ): Promise<T>;

  /**
   * Execute a database transaction that can contain multiple operations.
   * This executes the provided transaction callback, passing it the transaction
   * object. It handles committing or rolling back the transaction based on the
   * success or failure of the callback.
   * @template T - The type of data being returned by the transaction
   * @returns An AsyncGenerator that yields results and accepts new queries
   */
  abstract transaction<r, transaction>(
    callback: (transaction: Transaction) => Promise<r>
  ): Promise<r>;

  /**
   * Execute a raw query against the database
   * This allows for custom queries that aren't covered by the standard CRUD operations
   * @template T - The type of data being returned by the query
   * @param query - The query string to execute
   * @param params - Parameters to use in the query
   * @param options - Query options like session or transaction
   * @returns A promise that resolves to the query result
   */
  abstract execute<T = unknown>(
    query: string,
    params?: Record<string, unknown>,
    options?: Options
  ): Promise<T>;
}
