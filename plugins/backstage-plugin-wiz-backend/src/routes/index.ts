import express from 'express';
import Router from 'express-promise-router';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { WizClient } from '../services/WizClient';
import { WizAuth } from '../services/WizAuth';

import { errorHandler, formatError } from './ErrorHandler';
import {
  handleGetIssues,
  handleGetVulnerabilities,
  handleGetIssuesStats,
  handleGetCloudResources,
  handleGetVersionControl,
} from './Handlers';
import { WizError } from '../types';

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
      logger.error('Failed to initialize Wiz client', {
        type: error.type,
        message: error.message,
        error: formatError(error),
      });
    }
    throw error;
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

  router.use(errorHandler(logger));

  return router;
}
