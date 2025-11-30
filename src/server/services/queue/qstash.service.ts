
import type { AppEnv } from '@/types/cloudflare';
import type { ParsingQStashBody, ParsingServiceResponse } from '@/types/parsing.types';
import { qstashLogger } from '@/server/services/logger.service';

// File size threshold for direct vs queued processing
// Files smaller than this will be processed synchronously (direct call)
// Files larger than this will be queued through QStash (async)
const DIRECT_PROCESSING_THRESHOLD_MB = 2;
const DIRECT_PROCESSING_THRESHOLD_BYTES = DIRECT_PROCESSING_THRESHOLD_MB * 1024 * 1024;

export function isQStashConfigured(env: AppEnv): boolean {
  return !!(env.QSTASH_URL && env.QSTASH_TOKEN);
}

/**
 * Call parser service directly (used for small files < 2MB or in development)
 * This bypasses QStash and processes the file synchronously
 */
async function callParserServiceDirectly(
  env: AppEnv,
  data: ParsingQStashBody,
  parserUrl: string,
  callbackUrl: string
): Promise<{ 
  success: boolean; 
  messageId?: string; 
  error?: string;
  mode: 'direct';
  parsedData?: unknown;
}> {
  const isDevelopment = parserUrl.includes('localhost') || parserUrl.includes('127.0.0.1');
  const logger = qstashLogger(isDevelopment ? 'development' : 'production');
  
  try {
    const parseEndpoint = `${parserUrl}/api/v1/parse`;
    
    // In development, use local download endpoint
    // In production, use public R2 URL
    const isLocalDevelopment = parserUrl.includes('localhost') || parserUrl.includes('127.0.0.1');
    
    const fileUrl = isLocalDevelopment
      ? `${callbackUrl}/api/files/download/${data.r2Key}`  // Local R2 via API
      : env.R2_PUBLIC_URL?.startsWith('http')
        ? `${env.R2_PUBLIC_URL}/${data.r2Key}`            // Public R2
        : `https://${env.R2_PUBLIC_URL}/${data.r2Key}`;   // Public R2

    const requestBody = {
      file_id: data.fileId,
      file_url: fileUrl,
      mime_type: data.mimeType,
      language: data.language,
      subject: data.subject,
      document_type: data.documentType,
      options: {
        extract_images: true,
        extract_tables: true,
        extract_metadata: true,
        ocr_enabled: false,
        ai_description_enabled: false,
      },
    };

    logger.info('Sending direct request to parser service', {
      endpoint: parseEndpoint,
      fileId: data.fileId,
      fileSizeMB: (data.fileSizeBytes / 1024 / 1024).toFixed(2),
    });

    const response = await fetch(parseEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.info('Received response from parser service', {
      statusCode: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Parser service returned error', null, {
        statusCode: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      return { 
        success: false, 
        mode: 'direct' as const,
        error: `Parser service error: ${errorText}`,
        messageId: undefined,
        parsedData: undefined,
      };
    }

    const result = await response.json() as ParsingServiceResponse;
    
    if (result.success) {
      logger.info('Parser service completed successfully');
    } else {
      logger.warn('Parser service returned failure', { error: result.error });
    }
    
    return { 
      success: true,
      mode: 'direct' as const,
      parsedData: result,
      messageId: `direct-${data.jobId}`
    };
  } catch (error) {
    logger.error('Failed to call parser service', error);
    return {
      success: false,
      mode: 'direct' as const,
      error: error instanceof Error ? error.message : 'Failed to call parser service',
      messageId: undefined,
      parsedData: undefined,
    };
  }
}

export async function queueParsingJob(
  env: AppEnv,
  data: ParsingQStashBody
): Promise<{ 
  success: boolean; 
  messageId?: string; 
  error?: string;
  mode?: 'direct' | 'queued';
  parsedData?: unknown;
}> {
  const parserUrl = env.PARSER_SERVICE_URL || '';
  const isDevelopment = parserUrl.includes('localhost') || parserUrl.includes('127.0.0.1');
  const logger = qstashLogger(isDevelopment ? 'development' : 'production');
  
  logger.info('Starting parsing job', {
    fileId: data.fileId,
    fileSizeMB: (data.fileSizeBytes / 1024 / 1024).toFixed(2),
  });

  if (!parserUrl) {
    logger.error('Parser service URL not configured');
    return { success: false, error: 'Parser service URL not configured' };
  }

  const callbackUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const isLocalDevelopment = isDevelopment;
  const isSmallFile = data.fileSizeBytes < DIRECT_PROCESSING_THRESHOLD_BYTES;
  const fileSizeMB = (data.fileSizeBytes / 1024 / 1024).toFixed(2);

  // Route based on file size OR development mode
  if (isLocalDevelopment) {
    logger.info(`Development mode - using direct processing`, { fileSizeMB });
    return callParserServiceDirectly(env, data, parserUrl, callbackUrl);
  } else if (isSmallFile) {
    logger.info(`Small file - using direct processing`, {
      fileSizeMB,
      threshold: DIRECT_PROCESSING_THRESHOLD_MB,
    });
    return callParserServiceDirectly(env, data, parserUrl, callbackUrl);
  }

  // Large files in production: Use QStash for async processing
  logger.info(`Large file - using QStash queue`, {
    fileSizeMB,
    threshold: DIRECT_PROCESSING_THRESHOLD_MB,
  });
  
  if (!env.QSTASH_URL || !env.QSTASH_TOKEN) {
    logger.error('QStash configuration missing', {
      hasUrl: !!env.QSTASH_URL,
      hasToken: !!env.QSTASH_TOKEN,
    });
    return { success: false, error: 'QStash not configured' };
  }

  try {
    // QStash requires the destination URL in the path
    const destinationUrl = `${parserUrl}/api/v1/parse/qstash`;
    // Don't encode the entire URL - QStash needs the scheme intact
    const qstashEndpoint = `${env.QSTASH_URL}/v2/publish/${destinationUrl}`;

    // Check if we're using localhost parser (development mode)
    const isLocalParser = parserUrl.includes('localhost') || parserUrl.includes('127.0.0.1');
    
    // In development, use local download endpoint
    // In production, use public R2 URL
    const fileUrlForQStash = isLocalParser
      ? `${callbackUrl}/api/files/download/${data.r2Key}`  // Local R2 via API
      : env.R2_PUBLIC_URL?.startsWith('http')
        ? `${env.R2_PUBLIC_URL}/${data.r2Key}`            // Public R2
        : `https://${env.R2_PUBLIC_URL}/${data.r2Key}`;   // Public R2

    const requestBody = {
      file_id: data.fileId,
      file_url: fileUrlForQStash,
      mime_type: data.mimeType,
      language: data.language,           // REQUIRED
      subject: data.subject,             // REQUIRED
      document_type: data.documentType,  // REQUIRED
      // ❌ Removed user_id and job_id - parser service doesn't accept them
      options: {
        extract_images: true,
        extract_tables: true,
        extract_metadata: true,
        ocr_enabled: false,
        ai_description_enabled: false,
      },
    };

    const successCallback = `${callbackUrl}/api/files/parse-complete`;
    const failureCallback = `${callbackUrl}/api/files/parse-failed`;

    logger.info('Queuing job via QStash', {
      destination: destinationUrl,
      fileId: data.fileId,
      successCallback,
      failureCallback,
    });

    const response = await fetch(qstashEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Callback': successCallback,
        'Upstash-Failure-Callback': failureCallback,
        'Upstash-Retries': '3',
        'Upstash-Delay': '0',
      },
      body: JSON.stringify(requestBody),
    });

    logger.info('Received response from QStash', {
      statusCode: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('QStash returned error', null, {
        statusCode: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      return { success: false, error: `QStash error: ${errorText}` };
    }

    const result = await response.json() as { messageId: string };
    logger.info('Job queued successfully', {
      messageId: result.messageId,
      fileId: data.fileId,
      jobId: data.jobId,
    });
    
    return { 
      success: true, 
      mode: 'queued' as const,
      messageId: result.messageId 
    };
  } catch (error) {
    logger.error('Failed to queue parsing job', error);
    return {
      success: false,
      mode: 'queued' as const,
      error: error instanceof Error ? error.message : 'Failed to queue parsing job',
    };
  }
}