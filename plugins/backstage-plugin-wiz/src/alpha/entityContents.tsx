import {
  compatWrapper,
  convertLegacyRouteRef,
} from '@backstage/core-compat-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { WIZ_PROJECT_ANNOTATION } from '../utils/constants';
import { rootRouteRef } from '../routes';

/** @alpha */
export const wizEntityContent = EntityContentBlueprint.make({
  params: {
    path: '/wiz',
    title: 'Wiz',
    routeRef: convertLegacyRouteRef(rootRouteRef),
    filter: {
      [`metadata.annotations.${WIZ_PROJECT_ANNOTATION}`]: { $exists: true }
    },
    async loader() {
      const { App } = await import('../components/App');
      return compatWrapper(<App />);
    }
  },
});
