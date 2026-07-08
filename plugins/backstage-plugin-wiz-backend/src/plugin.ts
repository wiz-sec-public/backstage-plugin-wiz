import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './routes';

/**
 * backstagePluginWizPlugin backend plugin
 *
 * @public
 */
export const backstagePluginWizPlugin = createBackendPlugin({
  pluginId: 'backstage-plugin-wiz',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        cache: coreServices.cache,
      },
      async init({ httpRouter, logger, config, cache }) {
        httpRouter.use(
          await createRouter({
            logger,
            config,
            cache,
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
