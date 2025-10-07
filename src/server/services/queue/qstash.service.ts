import type { AppEnv } from '@/types/cloudflare';
import type { ParsingQStashBody } from '@/types/parsing.types';

export function isQStashConfigured(env: AppEnv): boolean {
  return !!(env.QSTASH_URL && env.QSTASH_TOKEN);
}

export async function queueParsingJob(
  env: AppEnv,
  data: ParsingQStashBody
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[QStash] Starting queue job with data:', data);

  if (!env.QSTASH_URL || !env.QSTASH_TOKEN) {
    console.error('[QStash] Missing config:', { url: env.QSTASH_URL, hasToken: !!env.QSTASH_TOKEN });
    return { success: false, error: 'QStash not configured' };
  }

  if (!env.PARSER_SERVICE_URL) {
    console.error('[QStash] Parser service URL not configured');
    return { success: false, error: 'Parser service URL not configured' };
  }

  try {
    // Ensure URLs have proper protocol
    const parserUrl = env.PARSER_SERVICE_URL;
    const callbackUrl = env.NEXT_PUBLIC_APP_URL || 'localhost:3000';

    // QStash requires the destination URL in the path
    const destinationUrl = `${parserUrl}/api/v1/parse/qstash`;
    // Don't encode the entire URL - QStash needs the scheme intact
    const qstashEndpoint = `${env.QSTASH_URL}/v2/publish/${destinationUrl}`;

    console.log('[QStash] Publishing to:', qstashEndpoint);
    console.log('[QStash] Destination URL:', destinationUrl);
    console.log('[QStash] Callbacks:', {
      success: `${callbackUrl}/api/files/parse-complete`,
      failure: `${callbackUrl}/api/files/parse-failed`,
    });

    const response = await fetch(qstashEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Callback': `${callbackUrl}/api/files/parse-complete`,
        'Upstash-Failure-Callback': `${callbackUrl}/api/files/parse-failed`,
        'Upstash-Retries': '3',
        'Upstash-Delay': '0',
      },
      body: JSON.stringify({
        file_id: data.fileId,
        file_url: env.R2_PUBLIC_URL?.startsWith('http')
          ? `${env.R2_PUBLIC_URL}/${data.r2Key}`
          : `https://${env.R2_PUBLIC_URL}/${data.r2Key}`,
        mime_type: data.mimeType,
        user_id: data.userId,
        job_id: data.jobId,
        options: {
          extract_images: true,
          extract_tables: true,
          extract_metadata: true,
          ocr_enabled: false,
          ai_description_enabled: false,
        },
      }),
    });

    console.log('[QStash] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[QStash] Error response:', errorText);
      return { success: false, error: `QStash error: ${errorText}` };
    }

    const result = await response.json() as { messageId: string };
    console.log('[QStash] Success! Message ID:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[QStash] Parsing queue error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue parsing job',
    };
  }
}