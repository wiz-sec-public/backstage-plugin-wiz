import { defineConfig } from 'taze';

export default defineConfig({
  write: true,
  install: true,
  // we update node manually
  exclude: ['@types/node'],
  maturityPeriod: 5 /* days */,
});
