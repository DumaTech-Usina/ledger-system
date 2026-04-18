export function makeRef() {
  let _seq = 0;
  return (label: string) => `${label}-${++_seq}`;
}
