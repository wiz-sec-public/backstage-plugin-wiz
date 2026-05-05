import express from 'express';
import { z } from 'zod';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { WizClient } from '../services/WizClient';
import { WizError, WizErrorType } from '../types';

const genericQuerySchema = z.record(z.any());

export async function handleGetIssues(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.project) {
      filters.project = queryParams.project;
    }

    if (queryParams.relatedEntity) {
      try {
        const relatedEntity = JSON.parse(String(queryParams.relatedEntity));
        if (relatedEntity.ids) {
          filters.relatedEntity = { ids: relatedEntity.ids };
        }
      } catch (error) {
        throw new WizError(
          WizErrorType.INVALID_REQUEST,
          'Invalid relatedEntity format',
          400,
          error,
        );
      }
    }

    if (queryParams.search) {
      filters.search = queryParams.search;
    }

    logger.debug('Wiz Issues: assembled filters', {
      filters: JSON.stringify(filters, null, 2),
    });

    const result = await wizClient.getIssues(
      filters,
      queryParams.after || null,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetVulnerabilities(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.projectId) {
      filters.projectId = queryParams.projectId;
    }

    if (queryParams.assetId) {
      filters.assetId = queryParams.assetId;
    }

    if (queryParams.vulnerabilityExternalId) {
      filters.vulnerabilityExternalId = queryParams.vulnerabilityExternalId;
    }

    logger.debug('Wiz Vulnerabilities: assembled filters', {
      filters: JSON.stringify(filters, null, 2),
    });

    const result = await wizClient.getVulnerabilityFindings(
      filters,
      queryParams.after || null,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetIssuesStats(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.project) {
      filters.project = queryParams.project;
    }

    if (queryParams.relatedEntity) {
      try {
        const relatedEntity = JSON.parse(String(queryParams.relatedEntity));
        if (relatedEntity.ids) {
          filters.relatedEntity = { ids: relatedEntity.ids };
        }
      } catch (error) {
        throw new WizError(
          WizErrorType.INVALID_REQUEST,
          'Invalid relatedEntity format',
          400,
          error,
        );
      }
    }

    logger.debug('Wiz Issues Stats: assembled filters', {
      filters: JSON.stringify(filters, null, 2),
    });

    const [severityCounts, groupedCounts] = await Promise.all([
      wizClient.getIssuesSeverityCounts(filters),
      wizClient.getIssuesGroupedCount(filters),
    ]);

    res.status(200).json({ severityCounts, groupedCounts });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCloudResources(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.providerUniqueId) {
      filters.providerUniqueId = parseProviderUniqueIds(
        queryParams.providerUniqueId,
      );
    }

    logger.debug('Wiz Cloud Resources: assembled filters', {
      filters: JSON.stringify(filters, null, 2),
    });

    const result = await wizClient.getAllCloudResources(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetVersionControl(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.search) {
      filters.search = queryParams.search;
    }

    logger.debug('Wiz Version Control: assembled filters', {
      filters: JSON.stringify(filters, null, 2),
    });

    const result = await wizClient.getVersionControlResources(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

function parseProviderUniqueIds(providerUniqueId: unknown): string[] {
  if (typeof providerUniqueId === 'string') {
    try {
      const parsed = JSON.parse(providerUniqueId);
      return Array.isArray(parsed) ? parsed : [providerUniqueId];
    } catch {
      return [providerUniqueId];
    }
  }

  if (Array.isArray(providerUniqueId)) {
    if (!providerUniqueId.every(id => typeof id === 'string')) {
      throw new WizError(
        WizErrorType.INVALID_REQUEST,
        'Invalid providerUniqueId format. Expected an array of strings.',
        400,
      );
    }
    return providerUniqueId;
  }

  throw new WizError(
    WizErrorType.INVALID_REQUEST,
    'Invalid providerUniqueId format. Expected an array of strings.',
    400,
  );
}

export async function handleGetGraphSearch(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
  logger: LoggerService,
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);

    if (!queryParams.annotations) {
      throw new WizError(
        WizErrorType.INVALID_REQUEST,
        'Missing required parameter: annotations',
        400,
      );
    }

    let annotations: Array<{ key: string; value: string }>;
    try {
      annotations = JSON.parse(String(queryParams.annotations));
      if (
        !Array.isArray(annotations) ||
        !annotations.every(
          a =>
            typeof a === 'object' &&
            typeof a.key === 'string' &&
            typeof a.value === 'string',
        )
      ) {
        throw new Error('Invalid annotations format');
      }
    } catch (error) {
      throw new WizError(
        WizErrorType.INVALID_REQUEST,
        'Invalid annotations format. Expected JSON array of {key, value} objects.',
        400,
        error,
      );
    }

    const projectId = queryParams.projectId
      ? String(queryParams.projectId)
      : '*';

    logger.debug('Wiz Graph Search: searching by K8S annotations', {
      annotations: JSON.stringify(annotations),
      projectId,
    });

    const result = await wizClient.getGraphSearchEntities(
      annotations,
      projectId,
    );

    logger.debug('Wiz Graph Search: results', {
      entityIds: result.entityIds.length,
      containerImageIds: result.containerImageIds.length,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
