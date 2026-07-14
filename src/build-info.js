// @ts-ignore Vite injects import.meta.env during the browser build.
const env = import.meta.env || {};

export const buildInfo = {
  buildCommit: env.VITE_BUILD_COMMIT || 'dev',
  buildTime: env.VITE_BUILD_TIME || 'dev'
};
