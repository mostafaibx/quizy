// Parser types for document processing pipeline

export type FileFormat = 'pdf' | 'docx' | 'doc' | 'txt' | 'rtf' | 'odt';

export type ParserType = 'pdf-parser' | 'docx-parser' | 'doc-parser' | 'text-parser' | 'rtf-parser' | 'odt-parser';

export interface FileValidation {
  isValid: boolean;
  format?: FileFormat;
  parser?: ParserType;
  mimeType: string;
  sizeInBytes: number;
  error?: string;
  warnings?: string[];
}

export interface ParserCapabilities {
  supportsImages: boolean;
  supportsTables: boolean;
  supportsStyles: boolean;
  supportsMetadata: boolean;
  supportsPageBreaks: boolean;
}

export interface ParserModule {
  name: ParserType;
  capabilities: ParserCapabilities;
  parse: (content: ArrayBuffer, options?: ParserOptions) => Promise<ParsedDocument>;
}

export interface ParserOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractMetadata?: boolean;
  ocrEnabled?: boolean;
  aiDescriptionEnabled?: boolean;
  maxPages?: number;
}

// Visual element types
export interface ImageElement {
  id: string;
  pageNumber: number;
  type: 'photo' | 'diagram' | 'chart' | 'illustration' | 'equation' | 'screenshot';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  extraction: {
    base64?: string;
    url?: string;
    aiDescription?: string;
    ocrText?: string;
    altText?: string;
    caption?: string;
  };
  context: {
    precedingText?: string;
    followingText?: string;
    relatedTopic?: string;
  };
}

export interface TableElement {
  id: string;
  pageNumber: number;
  position: {
    index: number;
  };
  structure: {
    headers: string[];
    rows: string[][];
    caption?: string;
    footnotes?: string[];
  };
  representations: {
    markdown: string;
    html: string;
    naturalLanguage: string;
  };
  analysis: {
    keyFacts: string[];
    comparisons: string[];
    trends?: string[];
    dataType: 'numerical' | 'categorical' | 'mixed';
  };
}

export interface DiagramElement {
  id: string;
  pageNumber: number;
  type: 'flowchart' | 'mindmap' | 'graph' | 'architecture' | 'other';
  extraction: {
    base64?: string;
    url?: string;
    aiDescription: string;
    components?: string[];
    relationships?: string[];
  };
}

// Page structure
export interface Page {
  pageNumber: number;
  content: string;
  metadata: {
    wordCount: number;
    characterCount: number;
    paragraphCount: number;
    hasImages: boolean;
    hasTables: boolean;
    hasDiagrams: boolean;
    estimatedReadingTime: number;
  };
  elements: {
    headings: HeadingElement[];
    paragraphs: ParagraphElement[];
    lists: ListElement[];
    images: ImageElement[];
    tables: TableElement[];
    diagrams: DiagramElement[];
    footnotes: string[];
    quotes: QuoteElement[];
  };
}

export interface HeadingElement {
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  index: number;
}

export interface ParagraphElement {
  text: string;
  index: number;
  type: 'body' | 'abstract' | 'conclusion' | 'note';
}

export interface ListElement {
  items: string[];
  type: 'ordered' | 'unordered';
  index: number;
}

export interface QuoteElement {
  text: string;
  citation?: string;
  index: number;
}

// Document structure
export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: string;
  modificationDate?: string;
  language?: string;
  totalPages: number;
  totalWordCount: number;
  totalCharacterCount: number;
  estimatedTotalReadingTime: number;
  documentType: 'academic' | 'business' | 'technical' | 'general' | 'educational';
  academicLevel?: 'elementary' | 'middle' | 'high' | 'undergraduate' | 'graduate';
}

export interface ProcessingInfo {
  parsedAt: string;
  parserVersion: string;
  extractionMethod: ParserType;
  processingTime: number;
  warnings?: string[];
  errors?: string[];
}

export interface ParsedDocument {
  documentId: string;
  fileName: string;
  mimeType: string;
  format: FileFormat;
  version: string;

  pages: Page[];
  fullText: string;

  metadata: DocumentMetadata;
  processingInfo: ProcessingInfo;

  // Quiz-ready content
  quizContent: QuizReadyContent;
}

export interface QuizReadyContent {
  pages: QuizReadyPage[];
  visualDescriptions: VisualDescription[];
  keyTopics: string[];
  summaryPoints: string[];
}

export interface QuizReadyPage {
  pageNumber: number;
  enhancedContent: string;
  elements: ContentElement[];
}

export interface ContentElement {
  type: 'text' | 'image' | 'table' | 'diagram' | 'equation';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface VisualDescription {
  id: string;
  type: 'image' | 'table' | 'diagram' | 'equation' | 'chart' | 'illustration';
  description: string;
  context: string;
  possibleQuestions: string[];
}

// Parser Registry
export interface ParserRegistry {
  parsers: Map<ParserType, ParserModule>;
  getParser: (format: FileFormat) => ParserModule | undefined;
  registerParser: (parser: ParserModule) => void;
}