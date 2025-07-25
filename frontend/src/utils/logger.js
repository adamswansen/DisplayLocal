export const DEBUG = import.meta.env.DEV;
export function log(...args) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
