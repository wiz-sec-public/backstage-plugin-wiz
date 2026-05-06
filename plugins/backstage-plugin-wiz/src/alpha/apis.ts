import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { wizApiRef, WizClient } from '../api';

/** @alpha */
export const wizApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: wizApiRef,
      deps: {
        fetchApi: fetchApiRef,
        discoveryApi: discoveryApiRef,
      },
      factory({ fetchApi, discoveryApi }) {
        return new WizClient({ fetchApi, discoveryApi });
      },
    }),
});
