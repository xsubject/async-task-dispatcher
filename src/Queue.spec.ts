import { describe, expect, test } from '@jest/globals'
import { Queue } from './Queue'
import { QueueConfig } from './QueueConfig'
import { WorkerFn } from './WorkerFn'

describe('Queue', () => {
    let queue: Queue<any, any>

    const shouldWork = async (cfg: QueueConfig<any, any>) => {
        const worker: WorkerFn<number, string> = async (item) =>
            `Processed: ${item}`
        queue = new Queue<number, string>({ worker, ...cfg })

        await queue.push(1)
        const result = await queue.get()
        expect(result).toBe('Processed: 1')

        queue.clear()
    }

    test('should push and get items with default worker', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({ worker })
        await queue.push(1)
        const result = await queue.get()
        expect(result).toBe('Processed: 1')
    })

    test('should push and get items with custom worker during push', async () => {
        const defaultWorker: WorkerFn<number, string> = async (item) => {
            return `Default: ${item}`
        }
        const customWorker: WorkerFn<number, string> = async (item) => {
            return `Custom: ${item}`
        }
        queue = new Queue<number, string>({ worker: defaultWorker })
        await queue.push(1, customWorker)
        const result = await queue.get()
        expect(result).toBe('Custom: 1')
    })

    test('should block push when queue size limit reached', async () => {
        // TODO
    })

    test('should block push when buffer size limit reached', async () => {
        // TODO
    })

    test('should push successfully after getting an item when limit reached', async () => {
        // TODO
    })

    test('should work with after-add policy', async () => {
        await shouldWork({ workPolicy: 'after-add' })
    })

    test('should work with async-cycle-one policy with default interval', async () => {
        await shouldWork({ workPolicy: 'async-cycle-one' })
    })

    test('should work with async-cycle-many policy with default interval', async () => {
        await shouldWork({ workPolicy: 'async-cycle-many', groupSize: 2 })
    })

    test('should work with async-cycle-one policy with custom interval', async () => {
        await shouldWork({ workPolicy: 'async-cycle-one', interval: 100 })
        await shouldWork({ workPolicy: 'async-cycle-one', interval: 200 })
    })

    test('should work with async-cycle-many policy with custom interval', async () => {
        await shouldWork({
            workPolicy: 'async-cycle-many',
            groupSize: 2,
            interval: 100,
        })
        await shouldWork({
            workPolicy: 'async-cycle-many',
            groupSize: 2,
            interval: 200,
        })
    })

    test('should work with async-cycle-many policy with different group sizes', async () => {
        await shouldWork({ workPolicy: 'async-cycle-many', groupSize: 5 })
        await shouldWork({ workPolicy: 'async-cycle-many', groupSize: 10 })
    })

    test('should clear intervals and remove after-push behavior on clear method call', async () => {
        const worker: WorkerFn<number, string> = async (item) =>
            `Processed: ${item}`
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-many',
            groupSize: 2,
        })

        await queue.push(1)
        queue.clear()

        expect(queue.clearead).toBe(true)
    })

    test.skip('should reflect correct state in length, size, buff, and working properties', async () => {
        // todo
    })

    test('should throw error when no worker is provided during initialization or push', async () => {
        queue = new Queue<number, string>()

        await expect(queue.push(1)).rejects.toThrow('Worker is not provided')
        await expect(queue.push(2, undefined)).rejects.toThrow(
            'Worker is not provided'
        )
    })

    test('should handle array responses from the worker function', async () => {
        const worker: WorkerFn<number, string[]> = async (item) => [
            `Processed: ${item}`,
            `Extra: ${item * 2}`,
        ]
        queue = new Queue<number, string[]>({ worker, workPolicy: 'after-add' })

        await queue.push(1)

        const result1 = await queue.get()
        const result2 = await queue.get()

        expect(result1).toBe('Processed: 1')
        expect(result2).toBe('Extra: 2')
    })

    test('should handle empty or undefined tasks', async () => {
        const worker: WorkerFn<number | undefined, string> = async (item) =>
            item ? `Processed: ${item}` : 'Undefined'
        queue = new Queue<number | undefined, string>({
            worker,
            workPolicy: 'after-add',
        })

        await queue.push(undefined)

        const result = await queue.get()
        expect(result).toBe('Undefined')
    })

    test('should handle concurrency and race conditions for simultaneous push and processing', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-one',
            interval: 5,
        })

        await Promise.all([queue.push(1), queue.push(2), queue.push(3)])

        const results = await Promise.all([
            queue.get(),
            queue.get(),
            queue.get(),
        ])

        expect(results.sort()).toEqual([
            'Processed: 1',
            'Processed: 2',
            'Processed: 3',
        ])
    })

    test('should handle multiple pushes before processing starts', async () => {
        const worker: WorkerFn<number, string> = async (item) =>
            `Processed: ${item}`
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-one',
            interval: 100,
        })

        await queue.push(1)
        await queue.push(2)

        const results = await Promise.all([queue.get(), queue.get()])

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
    })

    test('should handle simultaneous push and get operation', async () => {
        const worker: WorkerFn<number, string> = async (item) =>
            `Processed: ${item}`
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-one',
            interval: 5,
        })

        const pushPromise = queue.push(1)
        const getResult = queue.get()

        await pushPromise
        const result = await getResult

        expect(result).toBe('Processed: 1')
    })

    test('should process tasks concurrently when using async-cycle-one policy', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-one',
            interval: 5,
        })

        await queue.push(1)
        await queue.push(2)

        const startTime = Date.now()
        const results = await Promise.all([queue.get(), queue.get()])
        const endTime = Date.now()

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
        expect(endTime - startTime).toBeGreaterThanOrEqual(20)
    })

    test('should process tasks concurrently when using async-cycle-many policy', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({
            worker,
            workPolicy: 'async-cycle-many',
            groupSize: 2,
            interval: 5,
        })

        await queue.push(1)
        await queue.push(2)

        const startTime = Date.now()
        const results = await Promise.all([queue.get(), queue.get()])
        const endTime = Date.now()

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
        expect(endTime - startTime).toBeLessThanOrEqual(30)
    })

    test('should handle mixed worker functions for different tasks', async () => {
        const worker1: WorkerFn<number, string> = async (item) =>
            `Processed (1): ${item}`
        const worker2: WorkerFn<number, string> = async (item) =>
            `Processed (2): ${item}`
        queue = new Queue<number, string>({
            worker: worker1,
            workPolicy: 'after-add',
        })

        await queue.push(1)
        await queue.push(2, worker2)

        const results = await Promise.all([queue.get(), queue.get()])

        expect(results.sort()).toEqual(['Processed (1): 1', 'Processed (2): 2'])
    })

    test('should process tasks with different processing times', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            await new Promise((resolve) => setTimeout(resolve, item * 10))
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({ worker, workPolicy: 'after-add' })

        await queue.push(1)
        await queue.push(2)

        const results = await Promise.all([queue.get(), queue.get()])
        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
    })

    test('should handle tasks that fail during processing', async () => {
        const worker: WorkerFn<number, string> = async (item) => {
            if (item === 2) {
                throw new Error('Task failed')
            }
            return `Processed: ${item}`
        }
        queue = new Queue<number, string>({ worker, workPolicy: 'after-add' })

        await queue.push(1)
        await queue.push(2)

        const result1 = await queue.get()
        expect(result1).toBe('Processed: 1')

        await expect(queue.get()).rejects.toThrow('Task failed')
    })

    test('should work correctly when no config is provided during initialization', async () => {
        const worker: WorkerFn<number, string> = async (item) =>
            `Processed: ${item}`
        queue = new Queue<number, string>()

        await queue.push(1, worker)
        await queue.push(2, worker)

        const results = await Promise.all([queue.get(), queue.get()])

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
    })

    test('should handle tasks that return promises', async () => {
        const worker = (item: number) => {
            return new Promise<string>((resolve) => {
                setTimeout(() => resolve(`Processed: ${item}`), 10)
            })
        }
        const queue = new Queue<number, string>({
            worker,
            workPolicy: 'after-add',
        })

        await queue.push(1)
        await queue.push(2)

        const results = await Promise.all([queue.get(), queue.get()])

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
    })

    test('should handle tasks that return non-promise values', async () => {
        const worker: WorkerFn<number, string> = (item) => {
            return `Processed: ${item}`
        }
        const queue = new Queue<number, string>({
            worker,
            workPolicy: 'after-add',
        })

        await queue.push(1)
        await queue.push(2)

        const results = await Promise.all([queue.get(), queue.get()])

        expect(results.sort()).toEqual(['Processed: 1', 'Processed: 2'])
    })

    afterEach(() => {
        queue && !queue.clearead && queue.clear()
    })
})
