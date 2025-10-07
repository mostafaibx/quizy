// Visual content types for document parsing

export type ExtractionTier = 'basic' | 'enhanced' | 'ai-powered';

export interface ExtractionOptions {
  tier: ExtractionTier;
  extractTables?: boolean;
  extractImages?: boolean;
  aiProcessing?: boolean;
  maxImagesPerPage?: number;
}

// Lightweight visual representation for Tier 1
export interface VisualElement {
  type: 'image' | 'table' | 'diagram' | 'chart';
  pageNumber: number;
  index: number;

  // Text-only representations (no binary data)
  content: {
    description: string;
    altText?: string;
    caption?: string;
  };

  // Context from document
  context: {
    precedingText: string;
    followingText: string;
    isReferenced: boolean;
    referenceText?: string;
  };

  // For quiz generation
  metadata: {
    importance: 'low' | 'medium' | 'high';
    suggestedQuestions?: string[];
  };
}

// Table structure
export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;

  // Generated representations
  summary: string;
  markdown: string;
}

// Image placeholder for Tier 1
export interface ImagePlaceholder {
  exists: boolean;
  dimensions?: { width: number; height: number };
  format?: string;
  hasText: boolean;
}

// Enhanced content for Tier 3 (future)
export interface EnhancedVisualElement extends VisualElement {
  // AI-generated content
  aiContent?: {
    detailedDescription: string;
    extractedText?: string;
    identifiedObjects?: string[];
    relationships?: string[];
  };

  // Storage reference (if stored)
  storageRef?: {
    thumbnailKey?: string;
    fullImageKey?: string;
  };
}

// Page with visuals
export interface PageWithVisuals {
  pageNumber: number;
  text: string;
  visuals: VisualElement[];
}

// Processing result
export interface VisualExtractionResult {
  pages: PageWithVisuals[];
  summary: {
    totalImages: number;
    totalTables: number;
    totalDiagrams: number;
    tier: ExtractionTier;
  };
  warnings?: string[];
}