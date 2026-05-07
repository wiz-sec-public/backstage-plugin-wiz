import express from 'express';
import Router from 'express-promise-router';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { WizClient } from '../services/WizClient';
import { WizAuth } from '../services/WizAuth';

import { errorHandler } from './ErrorHandler';
import {
  handleGetIssues,
  handleGetVulnerabilities,
  handleGetIssuesStats,
  handleGetCloudResources,
  handleGetVersionControl,
  handleGetGraphSearch,
} from './Handlers';
import { WizError, WizErrorType } from '../types';

export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;
  const router = Router();

  let wizClient: WizClient;
  let wizAuth: WizAuth;
  try {
    wizClient = new WizClient(config, logger);
    wizAuth = new WizAuth(config);

    await wizAuth.fetchAccessToken();
  } catch (error) {
    if (error instanceof WizError) {
      logger.warn(
        `Wiz plugin disabled: ${error.message} (type=${error.type})`,
      );
    } else {
      logger.warn(
        `Wiz plugin disabled: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Return a degraded router that responds with 503 for all routes
    router.use((_req, res) => {
      res.status(503).json({
        error: 'Wiz plugin is not configured',
        type: WizErrorType.MISSING_CONFIG,
      });
    });
    return router;
  }

  // Mount route handlers first
  router.get('/wiz-issues', (req, res, next) =>
    handleGetIssues(req, res, next, wizClient, logger),
  );

  router.get('/wiz-vulnerabilities', (req, res, next) =>
    handleGetVulnerabilities(req, res, next, wizClient, logger),
  );

  router.get('/wiz-issues-stats', (req, res, next) =>
    handleGetIssuesStats(req, res, next, wizClient, logger),
  );

  router.get('/wiz-cloud-resources', (req, res, next) =>
    handleGetCloudResources(req, res, next, wizClient, logger),
  );

  router.get('/wiz-version-control', (req, res, next) =>
    handleGetVersionControl(req, res, next, wizClient, logger),
  );
  router.get('/wiz-graph-search', (req, res, next) =>
    handleGetGraphSearch(req, res, next, wizClient, logger),
  );

  router.use(errorHandler(logger));

  return router;
}
