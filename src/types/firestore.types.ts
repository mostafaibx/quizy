// Firestore Value Types
export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: FirestoreFields } };

export type FirestoreFields = Record<string, FirestoreValue>;

export interface FirestoreDocument {
  name?: string;
  fields: FirestoreFields;
  createTime?: string;
  updateTime?: string;
}

export interface FirestoreQueryResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

export interface FirestoreStructuredQuery {
  from: Array<{ collectionId: string }>;
  where?: {
    fieldFilter: {
      field: { fieldPath: string };
      op: 'EQUAL' | 'NOT_EQUAL' | 'GREATER_THAN' | 'LESS_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN_OR_EQUAL' | 'IN' | 'ARRAY_CONTAINS';
      value: FirestoreValue;
    };
  };
  orderBy?: Array<{
    field: { fieldPath: string };
    direction: 'ASCENDING' | 'DESCENDING';
  }>;
  limit?: number;
  offset?: number;
}

export interface FirestoreRunQueryRequest {
  structuredQuery: FirestoreStructuredQuery;
}

// JavaScript to Firestore type mapping
export type JSValue = null | boolean | number | string | Date | JSValue[] | { [key: string]: JSValue };

// Type guards
export const isNullValue = (value: FirestoreValue): value is { nullValue: null } =>
  'nullValue' in value;

export const isBooleanValue = (value: FirestoreValue): value is { booleanValue: boolean } =>
  'booleanValue' in value;

export const isIntegerValue = (value: FirestoreValue): value is { integerValue: string } =>
  'integerValue' in value;

export const isDoubleValue = (value: FirestoreValue): value is { doubleValue: number } =>
  'doubleValue' in value;

export const isStringValue = (value: FirestoreValue): value is { stringValue: string } =>
  'stringValue' in value;

export const isTimestampValue = (value: FirestoreValue): value is { timestampValue: string } =>
  'timestampValue' in value;

export const isArrayValue = (value: FirestoreValue): value is { arrayValue: { values: FirestoreValue[] } } =>
  'arrayValue' in value;

export const isMapValue = (value: FirestoreValue): value is { mapValue: { fields: FirestoreFields } } =>
  'mapValue' in value;