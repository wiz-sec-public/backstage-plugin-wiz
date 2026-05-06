import {
  createApiFactory,
  createPlugin,
  createRoutableExtension,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';
import { wizApiRef, WizClient } from './api';

export const backstagePluginWizPlugin = createPlugin({
  id: 'wiz',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: wizApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new WizClient({ discoveryApi, fetchApi }),
    }),
  ],
});

export const BackstagePluginWizPage = backstagePluginWizPlugin.provide(
  createRoutableExtension({
    name: 'BackstagePluginWizPage',
    component: () => import('./components/App').then(m => m.App),
    mountPoint: rootRouteRef,
  }),
);
