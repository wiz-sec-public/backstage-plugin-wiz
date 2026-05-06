import {
  createFrontendPlugin,
  type OverridableFrontendPlugin,
} from '@backstage/frontend-plugin-api';
import { wizApi } from './apis';
import { wizEntityContent } from './entityContents';

/** @alpha */
export const wizPlugin: OverridableFrontendPlugin = createFrontendPlugin({
  pluginId: 'wiz',
  extensions: [wizApi, wizEntityContent],
});
