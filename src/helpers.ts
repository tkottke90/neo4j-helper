import * as Neo4j from 'neo4j-driver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDateProperties(data: any, dateKeys: string[]) {
  for (const key of dateKeys) {
    if (data[key] instanceof Neo4j.types.DateTime) {
      data[key] = data[key].toString();
    }
  }
  return data;
}
