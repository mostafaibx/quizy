/**
 * Constants for file processing and parsing
 */

export const PARSING_VERSION = '1.0.0';
export const PARSER_SERVICE_VERSION = '2.0.0';

export const PROGRESS_MESSAGES = {
  QUEUED: { progress: 10, message: 'Document queued for parsing' },
  PROCESSING: { progress: 50, message: 'Parsing document content...' },
  COMPLETED: { progress: 100, message: 'Document parsing completed' },
  FAILED: { progress: 0, message: 'Document parsing failed' },
  PENDING: { progress: 10, message: 'File uploaded, waiting to process' },
} as const;

export const USER_MESSAGES = {
  DIRECT_SUCCESS: 'Document processed successfully!',
  QUEUED_SUCCESS: "Your document is being processed. We'll notify you when it's ready!",
  PROCESSING: 'File is still being processed',
  FAILED: 'File processing failed',
} as const;

