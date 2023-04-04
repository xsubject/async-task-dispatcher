import { describe, expect, test } from '@jest/globals'
import { Queue } from './Queue'

describe('Queue', () => {
    const nToS = (n: number) => n.toString()
    const nToS2 = (n: number) => (n + 1).toString()
    const queues = [new Queue({ worker: nToS, workPolicy: 'async-cycle-one' })]
    afterAll(() => {
        queues.map((queue) => queue.clear())
    })

    const isClear = (queue: Queue<any, any>) =>
        queue.length === 0 && queue.working === 0 && queue.buff === 0

    test('one push, gets valid', async () => {
        await queues[0].push(1)
        expect(await queues[0].get()).toBe('1')
        expect(isClear(queues[0])).toBe(true)
    })

    test('multiplie push, gets valid', async () => {
        await queues[0].push(1)
        await queues[0].push(2)
        await queues[0].push(3)
        expect(await queues[0].get()).toBe('1')
        expect(await queues[0].get()).toBe('2')
        expect(await queues[0].get()).toBe('3')

        expect(isClear(queues[0])).toBe(true)
    })

    describe('custom workers', () => {
        test('default worker', async () => {
            const q = new Queue({ worker: nToS })
            await q.push(1)
            expect(await q.get()).toBe('1')
        })

        test('custom worker', async () => {
            const q = new Queue<number, string>()
            await q.push(1, nToS)
            expect(await q.get()).toBe('1')
        })

        test('custom worker in priority', async () => {
            const q = new Queue({ worker: nToS })
            await q.push(1, nToS2)
            expect(await q.get()).toBe('2')
        })

        test('throwing error when worker not provided', async () => {
            const q = new Queue<number, string>({ workPolicy: 'after-add' })
            expect(async () => await q.push(1, undefined)).rejects.toThrow(
                'Worker is not provided'
            )
        })
    })
})
