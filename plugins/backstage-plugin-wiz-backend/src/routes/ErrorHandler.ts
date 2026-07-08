import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { LoggerService } from '@backstage/backend-plugin-api';
import { JsonObject } from '@backstage/types';
import { WizError, WizErrorType, ErrorResponse } from '../types';

export function formatError(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

export function formatZodError(error: z.ZodError): JsonObject {
  return {
    issues: error.errors.map(issue => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
  };
}

type ErrorMapType = {
  [key in WizErrorType]: {
    statusCode: number;
    error: string;
  };
};

export function handleWizError(error: WizError): {
  statusCode: number;
  response: ErrorResponse;
} {
  const baseResponse = {
    error: error.name,
    message: error.message,
    type: error.type,
  };

  const errorMap: ErrorMapType = {
    [WizErrorType.MISSING_CONFIG]: {
      statusCode: 400,
      error: 'Missing Configuration',
    },
    [WizErrorType.UNAUTHORIZED]: {
      statusCode: 401,
      error: 'Authentication Failed',
    },
    [WizErrorType.FORBIDDEN]: { statusCode: 403, error: 'Access Denied' },
    [WizErrorType.INVALID_REQUEST]: {
      statusCode: 400,
      error: 'Invalid Request',
    },
    [WizErrorType.API_ERROR]: { statusCode: 500, error: 'Wiz API Error' },
    [WizErrorType.RATE_LIMITED]: { statusCode: 429, error: 'Rate Limited' },
  };

  const errorInfo = errorMap[error.type] || {
    statusCode: error.statusCode || 500,
    error: 'Wiz API Error',
  };

  return {
    statusCode: errorInfo.statusCode,
    response: { ...baseResponse, error: errorInfo.error },
  };
}

export function errorHandler(logger: LoggerService) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.log(error);
    if (error instanceof z.ZodError) {
      const formattedError = formatZodError(error);
      logger.error('Invalid query parameters', { error: formattedError });
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'Invalid query parameters',
        details: formattedError,
        type: WizErrorType.INVALID_REQUEST,
      } satisfies ErrorResponse);
    }

    if (error instanceof WizError) {
      const { statusCode, response: errorResponse } = handleWizError(error);
      logger.error(error.message, {
        type: error.type,
        statusCode: error.statusCode,
        error: formatError(error),
      });
      return res.status(statusCode).json(errorResponse);
    }

    logger.error('Unexpected error', { error: formatError(error) });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      type: WizErrorType.API_ERROR,
    } satisfies ErrorResponse);
  };
}
