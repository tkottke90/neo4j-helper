# Neo4j Helper Module

A utility module for working with Neo4j Graph Databases in TypeScript/JavaScript applications. This module provides a clean, type-safe interface for interacting with Neo4j databases, including connection management, CRUD operations, and query building.

## Features

- **Singleton Connection Management**: Ensures only one connection is maintained across your application
- **Type-Safe Query Building**: Build Neo4j Cypher queries with TypeScript type safety
- **CRUD Operations**: Simple methods for creating, reading, updating, and deleting nodes
- **Relationship Management**: Create and query relationships between nodes
- **Transaction Support**: Execute multiple operations in a single transaction
- **Environment Configuration**: Easy setup with environment variables

## Installation

```bash
npm install neo4j-helper
```

## Quick Start

### 1. Setup Environment Variables

Create a `.env` file in your project root:

```
NEO4J_CONNECTION_STRING=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

### 2. Connect to Neo4j

```typescript
import { Neo4j } from 'neo4j-helper';
import { Logger } from './your-logger'; // Optional

// Create a logger (optional)
const logger = new Logger();

// Connect to Neo4j
await Neo4j.connect(logger);

// Create an instance
const neo4j = new Neo4j(logger);
```

### 3. Basic Operations

```typescript
// Insert a node
const user = await neo4j.insert('User', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Query nodes
const users = await neo4j.select('User', {
  where: { name: 'John Doe' }
});

// Update a node
await neo4j.upsert('User', user.id, {
  name: 'John Smith'
});

// Create a relationship
await neo4j.join(
  user.id,
  productId,
  'PURCHASED',
  'from'
);

// Execute a custom Cypher query
const result = await neo4j.execute(
  'MATCH (u:User)-[:PURCHASED]->(p:Product) RETURN u, p',
  {}
);

// Disconnect when done
await neo4j.disconnect();
```

## Advanced Usage: Query Builder

The module includes a `Neo4jQueryBuilder` class that allows you to construct complex Cypher queries with type safety. This is especially useful for building dynamic queries or when you need fine-grained control over the query structure.

### Basic Query Building

```typescript
import { Neo4jQueryBuilder } from 'neo4j-helper';

// Create a new query builder
const builder = new Neo4jQueryBuilder();

// Build a simple query to match a node
const { query, params } = builder
  .select('User', 'u', { name: 'John Doe' })
  .build();

// Execute the query
const result = await neo4j.execute(query, params);
```

### Building Complex Queries

```typescript
// Build a more complex query with relationships
const { query, params } = new Neo4jQueryBuilder()
  // Select nodes
  .select('User', 'user', { id: userId })
  .select('Product', 'product', { category: 'Electronics' })

  // Create a relationship
  .join('user', 'product', 'from', {
    label: 'PURCHASED',
    variable: 'r',
    properties: { date: new Date().toISOString() }
  })

  // Specify what to return
  .customReturn('user', 'product', 'r')
  .build();

// Execute the query
const result = await neo4j.execute(query, params);
```

### Type Safety

The QueryBuilder provides TypeScript type safety throughout the query building process:

```typescript
// The builder maintains type information as you chain methods
const builder = new Neo4jQueryBuilder()
  .select('User', 'u')
  .select('Product', 'p');

// TypeScript knows 'u' and 'p' are valid node variables
builder.join('u', 'p', 'from', { label: 'PURCHASED' });

// TypeScript would show an error for an invalid node variable
// builder.join('invalid', 'p'); // Error: Argument of type 'invalid' is not assignable...
```

### Debugging Queries

You can use the `peek()` method to inspect the current state of your query during development:

```typescript
const builder = new Neo4jQueryBuilder()
  .select('User', 'u', { name: 'John' })
  .join('u', 'p', 'from', { label: 'PURCHASED' })
  .peek() // Logs the current query and parameters to the console
  .customReturn('u', 'p');
```

## Configuration

The module uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| NEO4J_CONNECTION_STRING | Connection URL for Neo4j | bolt://localhost:7687 |
| NEO4J_USERNAME | Username for authentication | neo4j |
| NEO4J_PASSWORD | Password for authentication | your_password |
| NODE_ENV | Environment (affects logging) | development |

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint
```

## License

MIT
