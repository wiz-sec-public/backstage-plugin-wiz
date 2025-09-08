import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import { configApiRef, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { wizApiRef, WizClient } from '../api';

/** @alpha */
export const wizApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: wizApiRef,
      deps: {
        configApi: configApiRef,
        fetchApi: fetchApiRef,
        discoveryApi: discoveryApiRef,
      },
      factory({ configApi, fetchApi, discoveryApi }) {
        return new WizClient({ configApi, fetchApi, discoveryApi });
      },
    }),
});
