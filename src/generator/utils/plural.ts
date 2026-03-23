export function plural(count: number, one: string, other = `${one}s`) {
  return `${count} ${count === 1 ? one : other}`;
}
