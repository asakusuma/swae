export function addTimeout<T>(target: Promise<T>, msg: string, msTimeout: number = 1000): Promise<T> {
  const timeout = new Promise((_resolve, reject) => {
    // Create error outside of setTimeout to get proper stack
    const err = new Error(msg);
    const timer = setTimeout(() => {
      reject(err);
    }, msTimeout);
    const cancel = clearTimeout.bind(null, timer);
    // tslint:disable-next-line:no-floating-promises
    target.finally(cancel);
  });
  return Promise.race([target, timeout]) as Promise<T>;
}