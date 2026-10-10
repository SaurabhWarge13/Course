import { createSerialQueue } from '../../src/infrastructure/secure/serialQueue';

describe('createSerialQueue', () => {
  it('runs tasks in order, one at a time', async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const first = queue.run(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 10));
      order.push('first');
    });
    const second = queue.run(async () => {
      order.push('second');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });

  it('surfaces a task failure to its caller without blocking later tasks', async () => {
    const queue = createSerialQueue();
    await expect(queue.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(queue.run(async () => 'recovered')).resolves.toBe('recovered');
  });
});
