import { Mutex } from 'async-mutex'
import { QueueConfig } from './QueueConfig'
import { Task } from './Task'
import { WorkerFn } from './WorkerFn'

export class Queue<T, R> {
    public readonly queueSizeLimit?: number
    public readonly buffSizeLimit?: number
    public readonly workPolicy: string

    private readonly _worker?: WorkerFn<T, R>

    private _mu: Mutex = new Mutex()
    private _musl: Mutex = new Mutex()
    private _mug: Mutex = new Mutex()
    private _mugw: Mutex = new Mutex()
    private _muiw: Mutex = new Mutex()

    private _queue: Task<T>[] = []
    private _buff: R[] = []
    private _inWork: number = 0

    private _afterPush = () => {}

    private _intervals: NodeJS.Timeout[] = []
    private _cleared: boolean = false

    constructor(config: QueueConfig<T, R> = { workPolicy: 'after-add' }) {
        config = {
            ...{
                workPolicy: 'after-add',
            },
            ...config,
        }

        const { queueSizeLimit, buffSizeLimit, worker, workPolicy } = config

        this.workPolicy = workPolicy
        this.queueSizeLimit = queueSizeLimit
        this.buffSizeLimit = buffSizeLimit
        this._worker = worker

        if (config.workPolicy === 'async-cycle-one') {
            this._startInterval(config.interval)
        } else if (config.workPolicy === 'async-cycle-many') {
            for (let i = 0; i < config.groupSize; i++) {
                this._startInterval(config.interval)
            }
        } else if (config.workPolicy === 'after-add') {
            this._afterPush = () => this._work()
        }
    }

    private async _startInterval(interval: number = 100) {
        this._intervals.push(
            setInterval(() => {
                this._work()
            }, interval)
        )
    }

    private async _clerIntervals() {
        this._intervals.map((item) => clearInterval(item))
    }

    private async _safeInWorkIncrement(x: number) {
        const release = await this._muiw.acquire()
        this._inWork += x
        release()
    }

    private async _work() {
        const item = this._queue.shift()
        this._safeInWorkIncrement(1)
        if (item === undefined) return

        const worker = item.worker || this._worker
        if (worker === undefined) {
            throw new Error(`Worker is not provided`)
        }
        const response = await Promise.resolve(worker(item.task))

        if (Array.isArray(response)) {
            this._buff.push(...response)
        } else {
            this._buff.push(response)
        }
        this._safeInWorkIncrement(-1)

        if (this._mugw.isLocked()) {
            this._mugw.release()
        }
    }

    async getMany(count: number) {
        const response: R[] = []
        for (let i = 0; i < count; i++) {
            response.push((await this.get()) as R)
        }
        return response
    }

    async get(): Promise<R> {
        const release = await this._mug.acquire()

        const item = this._buff.shift()
        // console.log(item)

        if (item !== undefined) {
            if (this._musl.isLocked()) {
                this._musl.release()
            }
            release()
            return item
        }

        await this._mugw.acquire()
        await this._mugw.waitForUnlock()
        release()
        return await this.get()
    }

    async push(item: T | T[], worker?: WorkerFn<T, R>) {
        if (worker === undefined && this._worker === undefined) {
            throw new Error(`Worker is not provided`)
        }

        if (Array.isArray(item)) {
            item.map((v) => this.push(v, worker))
            return
        }

        const release = await this._mu.acquire()

        if (this._musl.isLocked()) {
            await this._musl.waitForUnlock()
        }

        if (
            (this.queueSizeLimit &&
                this._queue.length >= this.queueSizeLimit) ||
            (this.buffSizeLimit && this._buff.length >= this.buffSizeLimit)
        ) {
            await this._musl.acquire()
            await this._musl.waitForUnlock()
        }
        this._queue.push({
            task: item,
            worker,
        })
        release(), this._afterPush()
    }

    clear() {
        this._clerIntervals()
        this._afterPush = () => {}
        this._cleared = true
    }

    get length(): number {
        return this._queue.length + this._buff.length + this._inWork
    }

    get working(): number {
        return this._inWork
    }

    get size(): number {
        return this._queue.length
    }

    get buff(): number {
        return this._buff.length
    }

    get clearead(): boolean {
        return this._cleared
    }
}
