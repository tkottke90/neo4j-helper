import {
  Driver,
  Session,
  driver,
  auth,
  QueryResult,
  ManagedTransaction
} from 'neo4j-driver';
import {
  Database,
  QueryInterface,
  QueryOptions,
  RelationshipDirections
} from './database';
import { Logger } from './logging';
import { Neo4jQueryBuilder } from './query-builder';
import { parseDateProperties } from './helpers';

export type Node<T> = T & { labels: string[]; id: number };

/**
 * Neo4j database implementation with singleton pattern
 * This class provides methods to interact with a Neo4j database
 * and ensures only one connection is created across the application
 */
export class Neo4j extends Database<Session, ManagedTransaction> {
  /**
   * Singleton instance of the Neo4j class
   * @private
   */
  private static instance: Driver | null = null;

  /**
   * @param logger - Logger service instance
   * @private
   */
  constructor(private readonly logger: Logger) {
    super();
  }

  /**
   * Deletes a node with the specified ID
   * @template Key - The type of the node ID
   * @param nodeLabel - The label of the node to delete
   * @param id - The ID of the node to delete
   * @param options - Query options
   * @returns A promise that resolves to true if the node was deleted successfully
   */
  async delete<Key = number>(
    nodeLabel: string,
    id: Key,
    options = {}
  ): Promise<boolean> {
    try {
      const result = await this.execute<QueryResult>(
        `MATCH (n:${nodeLabel}) WHERE n.id = $id DETACH DELETE n`,
        { id },
        options
      );
      return result.records.length > 0;
    } catch (error: unknown) {
      this.logger.error(error as Error, 'Unable to delete node with id');
      return false;
    }
  }

  /**
   * Disconnects from the Neo4j database and clears the singleton instance
   * @returns Promise that resolves when the connection is closed
   */
  async disconnect(): Promise<void> {
    const driver = await Neo4j.getInstance();
    if (driver) {
      await driver.close();
      this.logger.log('info', 'Disconnected from Neo4j');

      // Clear the singleton instance when disconnecting
      Neo4j.instance = null;
    }
  }

  /**
   * Inserts a new node into the database
   * @template T - The type of data to insert
   * @param nodeLabel - The label for the new node
   * @param data - The data to insert
   * @param options - Query options
   * @returns A promise that resolves to the inserted data
   */
  async insert<T extends object = object>(
    nodeLabel: string,
    data: object,
    options = {}
  ): Promise<T> {
    return this.execute<QueryResult>(
      `CREATE (n:${nodeLabel} $data) RETURN n`,
      {
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      options
    ).then((result) => result.records[0].get('n').properties as T);
  }

  /**
   * Create a relationship between two nodes
   * @param relationshipLabel - The label for the relationship
   * @param source - The ID of the source node
   * @param target - The ID of the target node
   * @param direction - The direction of the relationship
   * @param options - Query options
   * @returns A promise that resolves to true if the relationship was created successfully
   */
  async join(
    relationshipLabel: string,
    source: number,
    target: number,
    direction: RelationshipDirections,
    options = {}
  ): Promise<boolean> {
    try {
      let directionStr = `-[r:${relationshipLabel}]-`;
      switch (direction) {
        case 'from':
          directionStr = `-[r:${relationshipLabel}]->`;
          break;
        case 'to':
          directionStr = `<-[r:${relationshipLabel}]-`;
          break;
        case 'both':
          directionStr = `-[r:${relationshipLabel}]-`;
          break;
      }

      const queryStr = [
        'MATCH (n) WHERE n.id = $source',
        'WITH n as source',
        'MATCH (m) where m.id = $target',
        'WITH m as target, source',
        `MERGE (source)${directionStr}(target)`,
        'RETURN r'
      ].join(' ');

      const result = await this.execute<QueryResult>(
        queryStr,
        { source, target, relationshipLabel },
        options
      );

      return result.records.length > 0;
    } catch (error) {
      this.logger.error(error as Error, 'Unable to join nodes');
      return false;
    }
  }

  /**
   * Selects nodes from the database based on a query
   * @template T - The type of data to select
   * @param table - The label of the nodes to select
   * @param query - The query to filter nodes
   * @param options - Query options
   * @returns A promise that resolves to the selected data
   */
  async select<T extends object = object>(
    table: string,
    query: QueryInterface<T>,
    options = {}
  ) {
    const { query: queryStr, params } = new Neo4jQueryBuilder()
      .select(table, 'n', query?.where)
      .build();

    return this.execute<QueryResult>(queryStr, params, options).then((result) =>
      this.parseResponse<T>(result)
    );
  }

  /**
   * Execute a database transaction that can contain multiple operations
   * @template T - The return type of the transaction
   * @param callback - The function to execute within the transaction
   * @returns A promise that resolves to the result of the transaction
   */
  async transaction<T>(
    callback: (transaction: ManagedTransaction) => Promise<T>
  ) {
    const session: Session = await this.getSession();

    return await session.executeWrite(callback);
  }

  /**
   * Updates an existing node in the database
   * @template T - The type of data to update
   * @template Key - The type of the node ID
   * @param nodeLabel - The label of the node to update
   * @param id - The ID of the node to update
   * @param data - The data to update
   * @param options - Query options
   * @returns A promise that resolves to the updated data
   */
  async update<T = unknown, Key = number>(
    nodeLabel: string,
    id: Key,
    data: object,
    options = {}
  ) {
    return this.execute<QueryResult>(
      `MATCH (n:${nodeLabel}) WHERE id(n) = $id SET n += $data, n.updatedAt = datetime() RETURN n`,
      {
        id,
        data
      },
      options
    ).then((result) => this.parseResponse<T>(result)[0]);
  }

  /**
   * Updates an existing node or creates it if it doesn't exist
   * @template T - The type of data to upsert
   * @param nodeLabel - The label of the node to upsert
   * @param id - The ID of the node to upsert
   * @param data - The data to upsert
   * @param options - Query options
   * @returns A promise that resolves to an array of the upserted nodes
   */
  async upsert<T = unknown>(
    nodeLabel: string,
    id: number,
    data: object,
    options = {}
  ) {
    return this.execute<QueryResult>(
      [
        'MERGE (n:' + nodeLabel + ' {id: $id})',
        'ON CREATE SET n += $data, n.createdAt = datetime(), n.updatedAt = datetime()',
        'ON MATCH SET n += $data, n.updatedAt = datetime()',
        'RETURN n'
      ].join(' '),
      {
        id,
        data
      },
      options
    ).then((result) => this.parseResponse<T>(result)[0]);
  }

  /**
   * Executes a Cypher query against the Neo4j database
   * @template T - The type of data being returned by the query
   * @param query - The Cypher query to execute
   * @param params - The parameters to use in the query
   * @param options - Query options
   * @returns A Promise resolving to the query result
   */
  async execute<T = QueryResult>(
    query: string,
    params: Record<string, unknown> = {},
    options: QueryOptions<Session, ManagedTransaction> = {}
  ): Promise<T> {
    // If passed a managed transaction, then we can simply use it
    // we do not need to try/catch because the managed transaction
    // comes from a wrapper function that handles the transaction
    if (options.transaction) {
      return options.transaction.run(query, params) as unknown as T;
    }

    // Otherwise we need to check if the session is passed in the options
    // or we need to get a new session
    const session: Session = options.session ?? (await this.getSession());

    try {
      const result = await session.run(query, params);
      return result as unknown as T;
    } finally {
      await session.close();
    }
  }

  /**
   * Gets a Neo4j session from the driver
   * @returns A Neo4j session
   * @private
   */
  protected async getSession() {
    const driver = await Neo4j.getInstance();

    if (!driver) {
      throw new Error('Failed to get Neo4j driver instance');
    }

    return driver.session();
  }

  /**
   * Parses a Neo4j QueryResult into an array of Node objects
   * @template T - The type of data in the nodes
   * @param result - The Neo4j QueryResult to parse
   * @returns An array of Node objects with the properties from the result
   * @protected
   */
  parseResponse<T>(result: QueryResult): Node<T>[] {
    const data = result.records.flatMap((record) => {
      const recordMetadata = record.toObject();

      return Object.values(recordMetadata).map((record) => {
        return parseDateProperties(
          {
            ...record.properties,
            labels: record.labels,
            _id: record.identity
          },
          ['createdAt', 'updatedAt', 'identity']
        );
      });
    });
    return data as Node<T>[];
  }

  /**
   * Creates a connection to the Neo4j database or returns the existing connection
   * @returns Promise resolving to the Neo4j instance
   */
  static async connect(logger?: Logger) {
    // If an instance already exists, return it
    if (Neo4j.instance) {
      return Neo4j.instance;
    }

    const connectionString =
      process.env.NEO4J_CONNECTION_STRING ?? 'bolt://localhost:7687';

    Neo4j.instance = driver(
      connectionString, // Replace with your Neo4j instance URL
      auth.basic('neo4j', 'your_password') // Replace with your credentials
    );

    logger?.log('debug', 'Connected to Neo4j', { database: connectionString });

    return Neo4j.instance;
  }

  /**
   * Gets the singleton instance of the Neo4j class
   * @returns Promise resolving to the Neo4j instance
   * @throws Error if called before connect()
   */
  static async getInstance(logger?: Logger) {
    if (!Neo4j.instance) {
      return Neo4j.connect(logger);
    }
    return Neo4j.instance;
  }
}
