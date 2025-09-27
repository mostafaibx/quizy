import { extractText, getDocumentProxy } from 'unpdf';

export interface ParsedContent {
  text: string;
  pageCount: number;
  metadata?: Record<string, unknown>;
}

export async function parseTextFile(content: ArrayBuffer): Promise<ParsedContent> {
  const decoder = new TextDecoder();
  const text = decoder.decode(content);
  const lines = text.split('\n');

  return {
    text: text.trim(),
    pageCount: Math.ceil(lines.length / 50),
    metadata: {
      lineCount: lines.length,
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
    },
  };
}

export async function parsePdfFile(content: ArrayBuffer): Promise<ParsedContent> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(content));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    return {
      text: text.trim(),
      pageCount: totalPages,
      metadata: {
        wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      },
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function parseDocFile(content: ArrayBuffer): Promise<ParsedContent> {
  const decoder = new TextDecoder();
  const text = decoder.decode(content);

  return {
    text: text.substring(0, 1000),
    pageCount: 1,
    metadata: {
      warning: 'DOC/DOCX parsing requires additional implementation',
      partial: true,
    },
  };
}

export async function parseFile(
  content: ArrayBuffer,
  mimeType: string
): Promise<ParsedContent> {
  if (mimeType === 'text/plain') {
    return parseTextFile(content);
  } else if (mimeType === 'application/pdf') {
    return parsePdfFile(content);
  } else if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return parseDocFile(content);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}