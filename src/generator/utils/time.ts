export function createDuration(): () => string {
  const startTime = performance.now();

  return () => `${(performance.now() - startTime).toFixed(0)}ms`;
}
