import { Mutex } from 'async-mutex'
import { QueueConfig } from './QueueConfig'
import { WorkerFn } from './WorkerFn'

export class Queue<T, R> {
    public readonly queueSizeLimit?: number
    public readonly buffSizeLimit?: number
    public readonly workPolicy: string

    private readonly _worker: WorkerFn<T, R>

    private _mu: Mutex = new Mutex()
    private _musl: Mutex = new Mutex()
    private _mug: Mutex = new Mutex()
    private _mugw: Mutex = new Mutex()

    private _queue: T[] = []
    private _buff: R[] = []
    private _inWork: number = 0

    private _afterPush = () => {}

    private _intervals: NodeJS.Timeout[] = []

    constructor(config: QueueConfig<T, R>) {
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

    private async _work() {
        const item = this._queue.shift()
        this._inWork = this._inWork + 1
        if (item === undefined) return

        const response = await Promise.resolve(this._worker(item))

        if (Array.isArray(response)) {
            this._buff.push(...response)
        } else {
            this._buff.push(response)
        }
        this._inWork = this._inWork - 1

        if (this._mugw.isLocked()) {
            this._mugw.release()
        }
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

    async push(item: T | T[]) {
        if (Array.isArray(item)) {
            item.map((v) => this.push(v))
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
        this._queue.push(item)
        release(), this._afterPush()
    }

    clear() {
        this._clerIntervals()
        this._afterPush = () => {}
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
}
