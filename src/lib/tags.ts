export function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap(value => value.split(',')).map(value => value.trim()).filter(value => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}