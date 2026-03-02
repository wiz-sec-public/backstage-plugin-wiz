import express from 'express';
import { z } from 'zod';
import { WizClient } from '../services/WizClient';
import { WizError, WizErrorType } from '../types';

const genericQuerySchema = z.record(z.any());

export async function handleGetIssues(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  wizClient: WizClient,
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
        const relatedEntityFilter: Record<string, unknown> = {};
        if (relatedEntity.ids) {
          relatedEntityFilter.ids = relatedEntity.ids;
        }
        if (relatedEntity.tag) {
          relatedEntityFilter.tag = relatedEntity.tag;
        }
        if (Object.keys(relatedEntityFilter).length > 0) {
          filters.relatedEntity = relatedEntityFilter;
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

    if (queryParams.assetTags) {
      try {
        const parsedAssetTags = JSON.parse(String(queryParams.assetTags));
        if (parsedAssetTags?.containsAny) {
          filters.assetTags = { containsAny: parsedAssetTags.containsAny };
        }
      } catch (error) {
        throw new WizError(
          WizErrorType.INVALID_REQUEST,
          'Invalid assetTags format',
          400,
          error,
        );
      }
    }

    if (queryParams.vulnerabilityExternalId) {
      filters.vulnerabilityExternalId = queryParams.vulnerabilityExternalId;
    }

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
        const relatedEntityFilter: Record<string, unknown> = {};
        if (relatedEntity.ids) {
          relatedEntityFilter.ids = relatedEntity.ids;
        }
        if (relatedEntity.tag) {
          relatedEntityFilter.tag = relatedEntity.tag;
        }
        if (Object.keys(relatedEntityFilter).length > 0) {
          filters.relatedEntity = relatedEntityFilter;
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
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.providerUniqueId) {
      filters.providerUniqueId = parseProviderUniqueIds(
        queryParams.providerUniqueId,
      );
    }
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
) {
  try {
    const queryParams = genericQuerySchema.parse(req.query);
    const filters: Record<string, unknown> = {};

    if (queryParams.search) {
      filters.search = queryParams.search;
    }

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
