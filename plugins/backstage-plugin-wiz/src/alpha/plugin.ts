import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { wizApi } from './apis';
import { wizEntityContent } from './entityContents';

/** @alpha */
export const wizPlugin = createFrontendPlugin({
  pluginId: 'wiz',
  extensions: [wizApi, wizEntityContent],
});
