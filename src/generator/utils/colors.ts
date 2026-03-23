type ColorFormatter = (value: unknown) => string;

const createColor = (open: number): ColorFormatter => {
  const prefix = `\x1b[${open}m`;
  const suffix = '\x1b[39m';

  if (!process.stdout?.isTTY) return (value) => `${value ?? ''}`;

  return (value) => `${prefix}${value ?? ''}${suffix}`;
};

export const blue = createColor(34);
export const gray = createColor(90);
export const green = createColor(32);
export const red = createColor(31);
export const yellow = createColor(33);
