import { catalogApiMock } from "@backstage/plugin-catalog-react/testUtils";

export const catalogApi = catalogApiMock({
  entities: [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'example',
        annotations: {
          'wiz.io/project-id': 'value',
        },
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'guest',
      },
    },
  ],
});
