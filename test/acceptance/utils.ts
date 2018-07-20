export function wait(time: number) {
  return new Promise((r) => {
    setTimeout(r, time);
  });
}