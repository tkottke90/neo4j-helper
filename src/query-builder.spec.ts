import { RelationshipDirections } from './database';
import { Neo4jQueryBuilder, Node } from './query-builder';

type BuildRelationShipRefCases = Array<
  [
    string,
    Partial<Node<string, string>>,
    Partial<Node<string, string>>,
    RelationshipDirections | undefined,
    (
      | Partial<{
          label: string;
          variable: string;
          properties: Record<string, unknown>;
        }>
      | undefined
    ),
    string,
    Record<string, unknown>
  ]
>;

describe('Neo4jQueryBuilder', () => {
  // Class construction tests
  describe('constructor', () => {
    it('should initialize with default values', () => {
      // Arrange
      const builder = new Neo4jQueryBuilder();

      // Assert
      expect(builder).toBeInstanceOf(Neo4jQueryBuilder);
      expect(builder.build()).toEqual({
        query: 'RETURN ',
        params: {}
      });
    });
  });

  // Method tests
  describe('build', () => {
    it('should build a query with a custom return statement', () => {
      // Arrange
      const expectedQuery = 'MATCH (test:TestLabel {id: $test_id}) RETURN test';
      const expectedParams = { test_id: 1 };

      const builder = new Neo4jQueryBuilder()
        .select('TestLabel', 'test', { id: 1 })
        .customReturn('test');

      // Act
      const { query, params } = builder.build();

      // Assert
      expect(query).toBe(expectedQuery);
      expect(params).toEqual(expectedParams);
    });
  });

  describe('buildNodeReference', () => {
    it('should build a node reference with a label and properties', () => {
      // Arrange
      const expectedNodeReference = 'test:TestLabel {id: $test_id}';
      const expectedParams = { test_id: 1 };

      const builder = new Neo4jQueryBuilder();

      // Act
      const nodeReference = builder.buildNodeReference('test', 'TestLabel', {
        id: 1
      });

      // Assert
      expect(nodeReference).toBe(expectedNodeReference);
      expect(builder.build().params).toEqual(expectedParams);
    });

    it('should omit the properties when none are provided', () => {
      // Arrange
      const expectedNodeReference = 'test:TestLabel';
      const expectedParams = {};

      const builder = new Neo4jQueryBuilder();

      // Act
      const nodeReference = builder.buildNodeReference('test', 'TestLabel');

      // Assert
      expect(nodeReference).toBe(expectedNodeReference);
      expect(builder.build().params).toEqual(expectedParams);
    });
  });

  describe('buildRelationshipReference', () => {
    describe('Basic Tests', () => {
      const cases: BuildRelationShipRefCases = [
        [
          'should build a relationship from existing nodes',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car)-[r:RACES_AT]->(prop)',
          {}
        ],
        [
          'should build a relationship with direction "to"',
          { variable: 'car' },
          { variable: 'prop' },
          'to',
          { label: 'RACES_AT', variable: 'r' },
          '(car)<-[r:RACES_AT]-(prop)',
          {}
        ],
        [
          'should build a relationship with direction "both"',
          { variable: 'car' },
          { variable: 'prop' },
          'both',
          { label: 'RACES_AT', variable: 'r' },
          '(car)-[r:RACES_AT]-(prop)',
          {}
        ],
        [
          'should build a relationship with direction "none"',
          { variable: 'car' },
          { variable: 'prop' },
          'none',
          { label: 'RACES_AT', variable: 'r' },
          '(car)-[r:RACES_AT]-(prop)',
          {}
        ],
        [
          'should use default direction "none" when not specified',
          { variable: 'car' },
          { variable: 'prop' },
          undefined,
          { label: 'RACES_AT', variable: 'r' },
          '(car)-[r:RACES_AT]-(prop)',
          {}
        ],
        [
          'should use exclude the relationship pattern when no label or variable is provided',
          { variable: 'car' },
          { variable: 'prop' },
          undefined,
          undefined,
          '(car)--(prop)',
          {}
        ]
      ];

      it.each(cases)(
        '%s',
        (
          _description,
          sourceNode,
          targetNode,
          direction,
          attributes,
          expectedQuery,
          expectedParams
        ) => {
          // Arrange
          const builder = new Neo4jQueryBuilder();

          // Act
          const relationshipReference = builder.buildRelationshipReference(
            sourceNode as any, // Using any here because the case list defines the type
            targetNode as any, // Using any here because the case list defines the type
            direction,
            attributes
          );

          // Assert
          expect(relationshipReference).toBe(expectedQuery);
          expect(builder.build().params).toEqual(expectedParams);
        }
      );
    });

    describe('Node Construction', () => {
      const cases: BuildRelationShipRefCases = [
        [
          'should build a relationship with source and target having labels',
          { variable: 'car', label: 'Car' },
          { variable: 'prop', label: 'Property' },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car:Car)-[r:RACES_AT]->(prop:Property)',
          {}
        ],
        [
          'should build a relationship with source and target having properties',
          { variable: 'car', properties: { id: 1 } },
          { variable: 'prop', properties: { type: 'ai_enabled' } },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car {id: $car_id})-[r:RACES_AT]->(prop {type: $prop_type})',
          { car_id: 1, prop_type: 'ai_enabled' }
        ],
        [
          'should build a relationship with source and target having both labels and properties',
          { variable: 'car', label: 'Car', properties: { id: 1 } },
          {
            variable: 'prop',
            label: 'Property',
            properties: { type: 'ai_enabled' }
          },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car:Car {id: $car_id})-[r:RACES_AT]->(prop:Property {type: $prop_type})',
          { car_id: 1, prop_type: 'ai_enabled' }
        ],
        [
          'should build a relationship with source having properties and target having none',
          { variable: 'car', properties: { id: 1 } },
          { variable: 'prop' },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car {id: $car_id})-[r:RACES_AT]->(prop)',
          { car_id: 1 }
        ],
        [
          'should build a relationship with target having properties and source having none',
          { variable: 'car' },
          { variable: 'prop', properties: { type: 'ai_enabled' } },
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(car)-[r:RACES_AT]->(prop {type: $prop_type})',
          { prop_type: 'ai_enabled' }
        ]
      ];

      it.each(cases)(
        '%s',
        (
          _description,
          sourceNode,
          targetNode,
          direction,
          attributes,
          expectedQuery,
          expectedParams
        ) => {
          // Arrange
          const builder = new Neo4jQueryBuilder();

          // Act
          const relationshipReference = builder.buildRelationshipReference(
            sourceNode as any, // Using any here because the case list defines the type
            targetNode as any, // Using any here because the case list defines the type
            direction,
            attributes
          );

          // Assert
          expect(relationshipReference).toBe(expectedQuery);
          expect(builder.build().params).toEqual(expectedParams);
        }
      );
    });

    describe('Relationship Attribute Tests', () => {
      const cases: BuildRelationShipRefCases = [
        [
          'should build a relationship with a relationship variable only',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { variable: 'rel' },
          '(car)-[rel]->(prop)',
          {}
        ],
        [
          'should build a relationship with a relationship label only',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { label: 'RACES_AT' },
          '(car)-[a:RACES_AT]->(prop)',
          {}
        ],
        [
          'should build a relationship with both relationship variable and label',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { variable: 'rel', label: 'RACES_AT' },
          '(car)-[rel:RACES_AT]->(prop)',
          {}
        ],
        [
          'should build a relationship with relationship properties',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { variable: 'rel', properties: { since: 2023 } },
          '(car)-[rel {since: $rel_since}]->(prop)',
          { rel_since: 2023 }
        ],
        [
          'should build a relationship with relationship variable, label, and properties',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { variable: 'rel', label: 'RACES_AT', properties: { since: 2023 } },
          '(car)-[rel:RACES_AT {since: $rel_since}]->(prop)',
          { rel_since: 2023 }
        ]
      ];

      it.each(cases)(
        '%s',
        (
          _description,
          sourceNode,
          targetNode,
          direction,
          attributes,
          expectedQuery,
          expectedParams
        ) => {
          // Arrange
          const builder = new Neo4jQueryBuilder();

          // Act
          const relationshipReference = builder.buildRelationshipReference(
            sourceNode as any, // Using any here because the case list defines the type
            targetNode as any, // Using any here because the case list defines the type
            direction,
            attributes
          );

          // Assert
          expect(relationshipReference).toBe(expectedQuery);
          expect(builder.build().params).toEqual(expectedParams);
        }
      );
    });

    describe('Edge Cases', () => {
      const cases: BuildRelationShipRefCases = [
        [
          'should handle empty source and target objects',
          {},
          {},
          'from',
          { label: 'RACES_AT', variable: 'r' },
          '(a)-[r:RACES_AT]->(b)',
          {}
        ],
        [
          'should handle properties with special characters',
          { variable: 'car' },
          { variable: 'prop' },
          'from',
          { variable: 'rel', properties: { 'special-key': 'special value' } },
          '(car)-[rel {special-key: $rel_special_key}]->(prop)',
          { rel_special_key: 'special value' }
        ],
        [
          'should handle very long variable names',
          { variable: 'veryLongVariableNameForSource' },
          { variable: 'veryLongVariableNameForTarget' },
          'from',
          {
            variable: 'veryLongVariableNameForRelationship',
            label: 'VERY_LONG_RELATIONSHIP_LABEL'
          },
          '(veryLongVariableNameForSource)-[veryLongVariableNameForRelationship:VERY_LONG_RELATIONSHIP_LABEL]->(veryLongVariableNameForTarget)',
          {}
        ]
      ];

      it.each(cases)(
        '%s',
        (
          _description,
          sourceNode,
          targetNode,
          direction,
          attributes,
          expectedQuery,
          expectedParams
        ) => {
          // Arrange
          const builder = new Neo4jQueryBuilder();

          // Act
          const relationshipReference = builder.buildRelationshipReference(
            sourceNode as any, // Using any here because the case list defines the type
            targetNode as any, // Using any here because the case list defines the type
            direction,
            attributes
          );

          // Assert
          expect(relationshipReference).toBe(expectedQuery);
          expect(builder.build().params).toEqual(expectedParams);
        }
      );
    });
  });

  describe('customReturn', () => {
    it('should build a return statement which includes only the selected nodes', () => {
      // Arrange
      const expectedQuery = 'RETURN car';

      const builder = new Neo4jQueryBuilder()
        .select('Car', 'car', { id: 1 })
        .select('Property', 'prop', { name: 'test' })
        .customReturn('car');

      // Act
      const { query } = builder.build();

      // Assert
      expect(query.endsWith(expectedQuery)).toBeTruthy();
    });
  });

  describe('peek', () => {
    beforeAll(() => {
      // Stub all the console methods
      jest.spyOn(console, 'log').mockReturnValue();
      jest.spyOn(console, 'error').mockReturnValue();
      jest.spyOn(console, 'warn').mockReturnValue();
      jest.spyOn(console, 'debug').mockReturnValue();
      jest.spyOn(console, 'info').mockReturnValue();
      jest.spyOn(console, 'dir').mockReturnValue();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should log the query and parameters', () => {
      // Arrange
      const expectedQuery = 'MATCH (test:TestLabel {id: $test_id}) RETURN test';
      const expectedParams = { test_id: 1 };

      const builder = new Neo4jQueryBuilder()
        .select('TestLabel', 'test', { id: 1 })
        .customReturn('test');

      // Act
      const logSpy = jest.spyOn(console, 'dir').mockReturnValue();
      builder.peek();

      // Assert
      expect(logSpy).toHaveBeenCalledWith({
        query: expectedQuery,
        params: expectedParams
      });
    });
  });

  describe('select', () => {
    it('should build a match statement for the selected node', () => {
      // Arrange
      const expectedQuery = 'MATCH (car:Car {id: $car_id}) RETURN car';
      const expectedParams = { car_id: 1 };

      const builder = new Neo4jQueryBuilder()
        .select('Car', 'car', { id: 1 })
        .customReturn('car');

      // Act
      const { query, params } = builder.build();

      // Assert
      expect(query).toBe(expectedQuery);
      expect(params).toEqual(expectedParams);
    });

    it('should auto-generate a node variable if none is provided', () => {
      // Arrange
      const expectedQuery = 'MATCH (a:Car) RETURN a';
      const expectedParams = {};

      const builder = new Neo4jQueryBuilder().select('Car');

      jest
        .spyOn(
          builder as unknown as { generateNodeVar: (v?: string) => string },
          'generateNodeVar'
        )
        .mockReturnValue('a');

      // Act
      const { query, params } = builder.build();

      // Assert
      expect(query).toBe(expectedQuery);
      expect(params).toEqual(expectedParams);
    });
  });

  describe('join', () => {
    it('should create a relationship between two nodes', () => {
      // Arrange
      const expectedQuery =
        'MATCH (car:Car {id: $car_id}) MATCH (prop:Property {type: $prop_type}) MATCH (car)-[r:RACES_AT]->(prop) RETURN car,prop';

      const expectedParams = { car_id: 1, prop_type: 'ai_enabled' };

      const builder = new Neo4jQueryBuilder()
        .select('Car', 'car', { id: 1 })
        .select('Property', 'prop', { type: 'ai_enabled' })
        .join('car', 'prop', 'from', { variable: 'r', label: 'RACES_AT' })
        .customReturn('car', 'prop');

      // Act
      const { query, params } = builder.build();

      // Assert
      expect(query).toBe(expectedQuery);
      expect(params).toEqual(expectedParams);
    });
  });
});
