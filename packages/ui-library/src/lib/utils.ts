export function trackByIndex(index: number) {
  return index;
}

export function removeIndent(str: string): string {
  str = str.replace(/^\n+/, '');
  const matches = str.match(/^ +/g);
  if (!matches) return str;
  const initial = matches[0].length;
  const re = RegExp(`^.{${initial}}`, 'gm');
  return str.replace(re, '');
}
