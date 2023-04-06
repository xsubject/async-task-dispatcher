# Async Task Dispatcher
[![npm version](https://badge.fury.io/js/async-task-dispatcher.svg)](https://badge.fury.io/js/async-task-dispatcher) [![CI](https://github.com/xsubject/async-task-dispatcher/actions/workflows/CI.yml/badge.svg)](https://github.com/xsubject/async-task-dispatcher/actions/workflows/CI.yml)

Async Task Dispatcher is a TypeScript library that implements a generic queue for processing tasks asynchronously and obtaining their results.

## Features

- Allows you to push tasks to the queue and receive individual results asynchronously.
- Supports configurable work policies and intervals for processing tasks.
- Allows you to set limits for the queue size and buffer size.
- Simple and easy-to-use API.

## Class: Queue<T, R>

### Type Parameters

- T: Task type
- R: Result type

### Constructor

The constructor takes a `QueueConfig` object as an argument.

### QueueConfig<T, R>

- `worker` (optional): Worker function that processes tasks of type `T` and returns a Promise of type `R`.
- `limit` (optional): Limits the maximum allowed size of the tasks in queue.
- `workPolicy`: Configures how tasks are processed in the queue.
  - `after-add` (default): The worker is started immediately after calling the `push()` method.
  - `async-cycle-one`: The worker is started in a separate asynchronous call with an optional `interval`.
  - `async-cycle-many`: Same as `async-cycle-one`, but with multiple asynchronous calls. The number of calls is determined by `groupSize`.
  - `undefined`: No specific work policy is applied.

### Methods

- `get(): Promise<R>`: Returns a single ready task result. If there are no results available, it will wait for them.
- `push(item: T | T[], worker?: WorkerFn<T, R>): Promise<void>`: Adds tasks to the queue.
- `clear(): void`: Stops the background worker.
- `get length(): number`: Returns the size of the task queue.
- `get buff(): number`: Returns the size of the results buffer.

## Usage

```typescript
import { Queue, QueueConfig } from 'async-task-dispatcher';

const config: QueueConfig<MyTask, MyResult> = {
  worker: async (task: MyTask): Promise<MyResult> => {
    // Process the task and return a result.
  },
  queueSizeLimit: 100,
  buffSizeLimit: 50,
  workPolicy: 'async-cycle-many',
  groupSize: 5,
  interval: 1000,
};

const queue = new Queue<MyTask, MyResult>(config);

// Add tasks to the queue.
await queue.push(task1);
await queue.push([task2, task3]);

// Get a single result of a processed task.
const result = await queue.get();

// Check the size of the task queue and the results buffer.
console.log(queue.length, queue.buff);

// Clear the background worker.
queue.clear();
```

## Example
```typescript

import { Queue, QueueConfig } from 'async-task-dispatcher';

const veryStrangeConverterNumberToString = async (x: number): Promise<string> => {
    return new Promise(done => {
        setTimeout(() => done(x.toString()), 100 * Math.random())
    })
}
const queue = new Queue<number, string>({
  worker: veryStrangeConverterNumberToString,
  queueSizeLimit: 3,
  buffSizeLimit: 3,
  workPolicy: 'async-cycle-one',
});

async function main() {
    setTimeout(async () => {
        const result0 = await queue.get() // 1
        const result1 = await queue.get() // 2
        const result2 = await queue.get() // 3
    }, 2000)

    await queue.push([1,2])
    await queue.push(3)

    // oops, sleep, according to queueSizeLimit, our queue cannot exceed 3
    // but timeout will be triggered soon
    await queue.push(4)
}

main()
```

## Installation
```bash
npm install async-task-dispatcher
```

## License
This project is licensed under the MIT License.