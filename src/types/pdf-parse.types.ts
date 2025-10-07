// Types for pdf-parse library

export interface PDFInfo {
  PDFFormatVersion?: string;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  Trapped?: string;
}

export interface PDFMetadata {
  _metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: PDFInfo;
  metadata: PDFMetadata | null;
  text: string;
  version: string;
}

export type PDFParseFunction = (dataBuffer: Buffer) => Promise<PDFParseResult>;