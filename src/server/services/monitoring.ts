export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  [key: string]: unknown;
}

export interface PipelineMetrics {
  tokensUsed: number;
  cost: number;
  processingTimeMs: number;
  questionsGenerated: number;
  provider: string;
}

export const createPipelineTracker = (
  analytics?: AnalyticsEngineDataset,
  env?: string
) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  const log = (level: LogLevel, message: string, data?: LogData) => {
    // Console log for development
    if (env !== 'production' || level === 'error') {
      console[level](`[${correlationId}] ${message}`, data || '');
    }

    // Send to Analytics Engine if available
    if (analytics) {
      analytics.writeDataPoint({
        blobs: [level, message, correlationId],
        doubles: [Date.now()],
        indexes: [JSON.stringify(data || {})]
      });
    }
  };

  return {
    correlationId,

    info: (message: string, data?: LogData) => log('info', message, data),
    warn: (message: string, data?: LogData) => log('warn', message, data),
    error: (message: string, error?: Error, data?: LogData) => {
      log('error', message, {
        ...data,
        error: {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        }
      });
    },

    trackStep: (step: string, data?: LogData) => {
      const elapsed = Date.now() - startTime;
      log('info', `Pipeline step: ${step}`, { ...data, elapsed });
    },

    trackMetrics: (metrics: PipelineMetrics) => {
      if (analytics) {
        analytics.writeDataPoint({
          blobs: ['metrics', correlationId, metrics.provider],
          doubles: [
            metrics.tokensUsed,
            metrics.cost,
            metrics.processingTimeMs,
            metrics.questionsGenerated
          ],
          indexes: ['quiz_generation']
        });
      }
    },

    complete: (success: boolean, data?: LogData) => {
      const duration = Date.now() - startTime;
      log('info', `Pipeline ${success ? 'completed' : 'failed'}`, {
        ...data,
        duration,
        success
      });
    }
  };
};