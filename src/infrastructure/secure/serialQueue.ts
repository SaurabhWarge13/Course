export type SerialQueue = {
  run<T>(task: () => Promise<T>): Promise<T>;
};

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run(task) {
      const result = tail.then(task, task);
      // A rejected task must surface to its caller but never block the next one.
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
