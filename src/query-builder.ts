import { RelationshipDirections } from './database';

type NodePropKeys = string | number | symbol;
export type NodeSelector<
  Label extends string,
  Variable extends string,
  Properties = Record<string, unknown>
> = {
  label?: Label;
  variable?: Variable;
  properties?: Properties;
};

const nodeVarIndex = 'abcdefghijklmnopqrstuvwxyz'.split('');

export class Neo4jQueryBuilder<
  Nodes extends string = never,
  Relationships extends string = never,
  Params extends Record<string, unknown> = Record<string, unknown>
> {
  private lastNodeVar = '';
  private lastNodeVarIndex = 0;

  private nodes: Map<string, { nodeVar: string; label: string }> = new Map();
  private params: Params = {} as Params;

  private query: string[] = [];
  private return = '';

  /**
   * Build and return the query string and parameters
   * @returns An object containing the query string and parameters
   */
  build() {
    const nodeKeys = Array.from(this.nodes.keys());

    return {
      query: [
        ...this.query,
        this.return ? this.return : `RETURN ${nodeKeys.join(', ')}`
      ].join(' '),
      params: this.params
    };
  }

  /**
   * Build a Cypher node reference with optional label and properties
   * @param nodeVar The variable name for the node
   * @param label Optional label for the node
   * @param properties Optional properties for the node
   * @returns A string representation of the node reference without parentheses
   */
  buildNodeReference(
    nodeVar: string,
    label = '',
    properties: Record<string, unknown> = {}
  ) {
    const { parameterizedString, parameters } = this.generatePropertySelectors(
      nodeVar,
      properties
    );

    this.params = { ...this.params, ...parameters };

    return [nodeVar, label ? `:${label}` : '', parameterizedString].join('');
  }

  buildRelationshipReference<
    SourceRef extends Partial<NodeSelector<string, Nodes>>,
    TargetRef extends Partial<NodeSelector<string, Nodes>>,
    RelationshipRef extends {
      variable: string;
      label: string;
      properties: Record<string, unknown>;
    }
  >(
    source: SourceRef,
    target: TargetRef,
    direction: RelationshipDirections = 'none',
    attributes: Partial<RelationshipRef> = {}
  ) {
    // Construct the node references which will be combined
    const sourceRef = `(${this.buildNodeReference(this.getNodeVarOrGenerate(source.variable), source.label, source.properties)})`;
    const targetRef = `(${this.buildNodeReference(this.getNodeVarOrGenerate(target.variable), target.label, target.properties)})`;

    // Determine if a relationship pattern is needed based on the label and variable
    let relationshipPattern = '';

    const relationshipVar = this.generateNodeVar(attributes.variable);

    if (attributes.label || attributes.variable) {
      const relationshipRef = this.buildNodeReference(
        relationshipVar,
        attributes.label,
        attributes.properties
      );

      relationshipPattern = `[${relationshipRef}]`;
    }

    // Determine the arrow direction based on the direction parameter
    let arrowDirection = '';
    switch (direction) {
      case 'from':
        arrowDirection = `-${relationshipPattern}->`;
        break;
      case 'to':
        arrowDirection = `<-${relationshipPattern}-`;
        break;
      case 'both':
      case 'none':
        arrowDirection = `-${relationshipPattern}-`;
        break;
    }

    // Since the relationship pattern can be empty, we should only,
    // store the relationship variable if we are using one
    if (relationshipPattern) {
      this.nodes.set(relationshipVar, {
        nodeVar: relationshipVar,
        label: attributes.label ?? ''
      });
    }

    return `${sourceRef}${arrowDirection}${targetRef}`;
  }

  createNode<NewNode extends Nodes>(
    label: string,
    properties: Record<string, unknown> = {},
    variable?: NewNode
  ) {
    const nodeVar = this.generateNodeVar(variable);
    this.nodes.set(nodeVar, { nodeVar, label });

    this.query.push(
      `MERGE (${this.buildNodeReference(nodeVar, label, properties)})`
    );

    return this as unknown as Neo4jQueryBuilder<
      Nodes | NewNode,
      Relationships,
      Params
    >;
  }

  /**
   * Add a custom RETURN clause to the query
   * @param nodes The node variables to return
   * @returns The QueryBuilder instance for chaining
   */
  customReturn<SelectedNodes extends Nodes>(...nodes: SelectedNodes[]) {
    this.return = `RETURN ${nodes.join(',')}`;
    return this;
  }

  /**
   * Creates a relationship between two nodes in the query
   * @param sourceNode The variable name of the source node
   * @param targetNode The variable name of the target node
   * @param direction The direction of the relationship (from, to, both, none)
   * @param relationshipType Optional type/label for the relationship
   * @returns The QueryBuilder instance for chaining
   */
  join<
    Source extends Nodes,
    Target extends Nodes,
    Relationship extends string,
    NodeVar extends string
  >(
    sourceNode: Source,
    targetNode: Target,
    direction: RelationshipDirections = 'none',
    attributes?: Partial<{
      label: Relationship;
      variable: NodeVar;
      properties: Record<string, unknown>;
    }>
  ) {
    // Build the relationship reference
    const queryStr = this.buildRelationshipReference(
      { variable: sourceNode },
      { variable: targetNode },
      direction,
      attributes
    );

    // Add the MATCH statement to the query array
    // Format: MATCH (source)-[relationship]->(target)
    this.query.push(`MATCH ${queryStr}`);

    return this as unknown as Neo4jQueryBuilder<
      Nodes,
      Relationships | Relationship,
      Params
    >;
  }

  /**
   * Debug method to log the current query and parameters
   * Only logs in non-production environments
   * @returns The QueryBuilder instance for chaining
   */
  peek() {
    if (!process.env.NODE_ENV?.startsWith('prod')) {
      console.dir(this.build());
    } else {
      console.warn('peek() called in production environment');
    }

    return this;
  }

  /**
   * Add a MATCH clause for a node with the given label
   * @param label The node label
   * @param nodeVar Optional variable name for the node (auto-generated if not provided).  Note that the autogenerated value is not typed so it wont show up in other methods
   * @param conditions Optional conditions for the node
   * @returns The QueryBuilder instance for chaining
   */
  select<Node extends string, Filter extends Record<string, unknown>>(
    label: string,
    nodeVar?: Node,
    filter?: Filter
  ) {
    const node = this.generateNodeVar(nodeVar);
    this.nodes.set(node, { nodeVar: node, label });

    this.query.push(`MATCH (${this.buildNodeReference(node, label, filter)})`);

    return this as unknown as Neo4jQueryBuilder<
      Nodes | Node,
      Relationships,
      Params & Filter
    >;
  }

  /**
   * Generate a unique node variable name
   * @param variable Optional variable name to use as a base
   * @returns A unique node variable name
   * @private
   */
  private generateNodeVar(variable?: string) {
    let nodeVar = variable;

    // When the node variable is not provided, we need to generate it
    if (!nodeVar) {
      // The node name will be a concatenation of a prefix and the next letter in the alphabet.
      // This provides a simple continuous list of generic node names.
      //
      // Example:
      //    - a
      //    - b
      //    - c
      //    - ...
      //    - z
      //    - aa
      //    - ab
      //    - ac
      //    - ...
      //
      nodeVar = this.lastNodeVar + nodeVarIndex[this.lastNodeVarIndex];

      this.lastNodeVarIndex++;

      // If we have reached the end of the alphabet, we need to reset the index
      // and increment the prefix
      if (this.lastNodeVarIndex > nodeVarIndex.length - 1) {
        this.lastNodeVarIndex = 0;
        this.lastNodeVar += nodeVarIndex[this.lastNodeVarIndex];
      }
    }

    // Particularly when the variable is provided, we should make sure that
    // the node variable is unique.  We can do this by adding a index suffix
    // to the node variable when the node variable already exists
    if (this.nodes.has(nodeVar)) {
      const nodeIndex = this.similarNodes(nodeVar).length;
      nodeVar = `${nodeVar}_${nodeIndex}`;
    }

    return nodeVar;
  }

  private getNodeVarOrGenerate(nodeVar?: string) {
    return nodeVar ?? this.generateNodeVar();
  }

  /**
   * Generate parameterized property selectors for a node
   * @param nodeVar The variable name for the node
   * @param record The properties to parameterize
   * @returns An object containing the parameterized string and parameters
   * @private
   */
  private generatePropertySelectors(
    nodeVar: string,
    record: Record<NodePropKeys, unknown>
  ) {
    // If there are no keys, then there are no parameters
    if (Object.keys(record).length === 0) {
      return {
        parameterizedString: '',
        parameters: {}
      };
    }

    const parameterizedStrArr: string[] = [];
    const params: Record<string, unknown> = {};

    // Loop through each of the keys and add to the parameterized string and parameters map
    for (const [key, value] of Object.entries(record)) {
      // Create a unique key for each parameter
      // Replace any non-alphanumeric characters with underscore for the parameter key
      const sanitizedKey = key.toString().replace(/[^a-zA-Z0-9]/g, '_');
      const paramKey = `${nodeVar}_${sanitizedKey}`;

      params[paramKey] = value;
      parameterizedStrArr.push(`${key}: $${paramKey}`);
    }

    return {
      parameterizedString: ` {${parameterizedStrArr.join(', ')}}`,
      parameters: params
    };
  }

  /**
   * Extract a list of nodes that have the same starting values as
   * the provided node variable.  This can be used to determine how
   * many nodes have a similar name and to increment them as to avoid
   * collisions
   *
   * @param nodeVar The variable to check for similar nodes
   * @returns A list of nodes that have the same starting values as the provided node variable
   */
  private similarNodes(nodeVar: string) {
    return Array.from(this.nodes.keys()).filter((node) =>
      node.startsWith(nodeVar)
    );
  }
}
