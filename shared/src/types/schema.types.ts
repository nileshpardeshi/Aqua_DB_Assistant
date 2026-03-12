import { RelationshipType, TableType, SensitivityTag } from './enums';

export interface TableMetadata {
  id: string;
  projectId: string;
  schemaName: string;
  tableName: string;
  tableType: TableType;
  description: string | null;
  estimatedRows: number | null;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  constraints: ConstraintMetadata[];
}

export interface ColumnMetadata {
  id: string;
  tableId: string;
  columnName: string;
  dataType: string;
  normalizedType: string | null;
  ordinalPosition: number;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  characterMaxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  description: string | null;
  sensitivityTag: SensitivityTag | null;
}

export interface IndexMetadata {
  id: string;
  tableId: string;
  indexName: string;
  indexType: string;
  isUnique: boolean;
  isPrimary: boolean;
  columns: string[];
}

export interface ConstraintMetadata {
  id: string;
  tableId: string;
  constraintName: string;
  constraintType: string;
  definition: string | null;
  columns: string[];
}

export interface RelationshipMetadata {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  relationshipType: RelationshipType;
  sourceColumns: string[];
  targetColumns: string[];
  constraintName: string | null;
  isInferred: boolean;
  onDelete: string | null;
  onUpdate: string | null;
}

// ER Diagram types
export interface ERNode {
  id: string;
  type: 'erTable';
  data: ERTableNodeData;
  position: { x: number; y: number };
}

export interface ERTableNodeData {
  schemaName: string;
  tableName: string;
  tableType: string;
  columns: ERColumnData[];
  indexCount: number;
  estimatedRows: number | null;
}

export interface ERColumnData {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
}

export interface EREdge {
  id: string;
  source: string;
  target: string;
  type: 'erRelationship';
  data: ERRelationshipEdgeData;
  animated?: boolean;
}

export interface ERRelationshipEdgeData {
  relationshipType: RelationshipType;
  sourceColumns: string[];
  targetColumns: string[];
  constraintName: string | null;
  isInferred: boolean;
}

export interface ERDiagramData {
  nodes: ERNode[];
  edges: EREdge[];
}
