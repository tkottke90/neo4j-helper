import { Neo4j } from './neo4j';
import { Logger } from './logging';
import { QueryResult, Transaction } from 'neo4j-driver';
import { RelationshipDirections } from './database';

// Mock the neo4j-driver
jest.mock('neo4j-driver', () => {
  // Define the mock transaction
  const mockTransaction = {
    run: jest.fn().mockResolvedValue({
      records: [
        {
          get: jest.fn().mockReturnValue({
            properties: { id: 1, name: 'Test Transaction' },
            labels: ['TestLabel']
          })
        }
      ]
    }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  };

  const mockSession = {
    run: jest.fn().mockResolvedValue({
      records: [
        {
          get: jest.fn().mockReturnValue({
            properties: { id: 1, name: 'Test' },
            labels: ['TestLabel']
          }),
          toObject: jest.fn().mockReturnValue({
            n: {
              properties: { id: 1, name: 'Test' },
              labels: ['TestLabel']
            }
          })
        }
      ]
    }),
    close: jest.fn().mockResolvedValue(undefined),
    beginTransaction: jest.fn().mockReturnValue(mockTransaction)
  };

  const mockDriver = {
    session: jest.fn().mockReturnValue(mockSession),
    close: jest.fn().mockResolvedValue(undefined)
  };

  return {
    ...jest.requireActual('neo4j-driver'),
    driver: jest.fn().mockReturnValue(mockDriver),
    auth: {
      basic: jest
        .fn()
        .mockReturnValue({ username: 'neo4j', password: 'password' })
    }
  };
});

// Mock the logger service
const mockLogger: Logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('Neo4j', () => {
  let neo4j: Neo4j;

  beforeEach(() => {
    // Reset the singleton instance before each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Neo4j as any).instance = null;

    // Create a new instance with the mock logger
    neo4j = new Neo4j(mockLogger);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('static methods', () => {
    describe('connect', () => {
      it('should create a new driver instance if none exists', async () => {
        // == Arrange ==
        // No arrangement needed, instance is null from beforeEach

        // == Act ==
        const instance = await Neo4j.connect();

        // == Assert ==
        expect(instance).not.toBeNull();
      });

      it('should return the existing instance if one exists', async () => {
        // == Arrange ==
        const instance1 = await Neo4j.connect();

        // == Act ==
        const instance2 = await Neo4j.connect();

        // == Assert ==
        expect(instance1).toBe(instance2);
      });
    });

    describe('getInstance', () => {
      it('should call connect if no instance exists', async () => {
        // == Arrange ==
        const connectSpy = jest.spyOn(Neo4j, 'connect');

        // == Act ==
        await Neo4j.getInstance();

        // == Assert ==
        expect(connectSpy).toHaveBeenCalled();
      });

      it('should return the existing instance if one exists', async () => {
        // == Arrange ==
        const instance1 = await Neo4j.connect();

        // == Act ==
        const instance2 = await Neo4j.getInstance();

        // == Assert ==
        expect(instance1).toBe(instance2);
      });
    });
  });

  describe('public methods', () => {
    describe('delete', () => {
      it('should delete a node and return true if successful', async () => {
        // == Arrange ==
        // No specific arrangement needed

        // == Act ==
        const result = await neo4j.delete('TestLabel', 1);

        // == Assert ==
        expect(result).toBe(true);
      });

      it('should return false and log error if deletion fails', async () => {
        // == Arrange ==
        // Mock the execute method to throw an error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest
          .spyOn(neo4j as any, 'execute')
          .mockRejectedValueOnce(new Error('Delete failed'));

        // == Act ==
        const result = await neo4j.delete('TestLabel', 1);

        // == Assert ==
        expect(result).toBe(false);
      });
    });

    describe('disconnect', () => {
      it('should close the connection and clear the instance', async () => {
        // == Arrange ==
        await Neo4j.connect();

        // == Act ==
        await neo4j.disconnect();

        // == Assert ==
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((Neo4j as any).instance).toBeNull();
      });
    });

    describe('insert', () => {
      it('should insert a node and return the properties', async () => {
        // == Arrange ==
        const data = { name: 'Test Node' };

        // == Act ==
        const result = await neo4j.insert('TestLabel', data);

        // == Assert ==
        expect(result).toEqual({ id: 1, name: 'Test' });
      });
    });

    describe('join', () => {
      it('should create a relationship between nodes with the specified direction', async () => {
        // == Arrange ==
        const directions: RelationshipDirections[] = [
          'from',
          'to',
          'both',
          'none'
        ];

        // == Act & Assert ==
        for (const direction of directions) {
          const result = await neo4j.join('RELATED_TO', 1, 2, direction);
          expect(result).toBe(true);
        }
      });

      it('should return false and log error if join fails', async () => {
        // == Arrange ==
        // Mock the execute method to throw an error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest
          .spyOn(neo4j as any, 'execute')
          .mockRejectedValueOnce(new Error('Join failed'));

        // == Act ==
        const result = await neo4j.join('RELATED_TO', 1, 2, 'from');

        // == Assert ==
        expect(result).toBe(false);
      });
    });

    describe('select', () => {
      it('should select a node based on query parameters', async () => {
        // == Arrange ==
        const query = { where: { id: 1 } };

        const expectSpy = jest.spyOn(neo4j, 'execute');

        // == Act ==
        await neo4j.select('TestLabel', query);

        // == Assert ==
        expect(expectSpy).toHaveBeenCalledWith(
          'MATCH (n:TestLabel {id: $n_id}) RETURN n',
          { n_id: 1 },
          {}
        );
      });
    });

    describe('transaction', () => {
      it('should execute the callback passing the transaction', async () => {
        // == Arrange ==
        const callback = jest.fn().mockResolvedValue({ success: true });

        const mockTransaction = jest.mocked(Transaction);
        const executeWriteSpy = jest.fn().mockImplementation((callback) => {
          callback(mockTransaction);
          return Promise.resolve({ success: true });
        });

        jest.spyOn(neo4j as any, 'getSession').mockResolvedValue({
          executeWrite: executeWriteSpy
        });

        // == Act ==
        await neo4j.transaction(callback);

        // == Assert ==
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should execute a update query', async () => {
        // == Arrange ==
        const data = { name: 'Updated Node' };

        const expectSpy = jest.spyOn(neo4j, 'execute');

        // == Act ==
        await neo4j.update('TestLabel', 1, data);

        // == Assert ==
        expect(expectSpy).toHaveBeenCalledWith(
          'MATCH (n:TestLabel) WHERE id(n) = $id SET n += $data, n.updatedAt = datetime() RETURN n',
          { id: 1, data },
          {}
        );
      });
    });

    describe('upsert', () => {
      it('should execute an upsert query', async () => {
        // == Arrange ==
        const data = { name: 'Upsert Node' };
        const expectSpy = jest.spyOn(neo4j, 'execute');

        // == Act ==
        await neo4j.upsert('TestLabel', 1, data);

        // == Assert ==
        expect(expectSpy).toHaveBeenCalledWith(
          'MERGE (n:TestLabel {id: $id}) ON CREATE SET n += $data, n.createdAt = datetime(), n.updatedAt = datetime() ON MATCH SET n += $data, n.updatedAt = datetime() RETURN n',
          { id: 1, data },
          {}
        );
      });
    });
  });

  describe('private methods', () => {
    describe('parseResponse', () => {
      it('should parse a Neo4j query result into an array of nodes', async () => {
        // == Arrange ==
        // Create a mock QueryResult
        const mockResult = {
          records: [
            {
              toObject: jest.fn().mockReturnValue({
                n: {
                  properties: { id: 1, name: 'Test' },
                  labels: ['TestLabel']
                }
              })
            }
          ]
        } as unknown as QueryResult;

        // == Act ==
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (neo4j as any).parseResponse(mockResult);

        // == Assert ==
        expect(result).toEqual([
          { id: 1, name: 'Test', labels: ['TestLabel'] }
        ]);
      });
    });
  });
});
