import { WorkerFn } from './WorkerFn'

export type Task<T> = {
    task: T
    worker?: WorkerFn<T, any>
}
