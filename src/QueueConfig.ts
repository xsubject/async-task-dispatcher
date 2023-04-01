import { WorkerFn } from './WorkerFn'

export type QueueConfig<T, R> = {
    worker: WorkerFn<T, R>
    queueSizeLimit?: number
    buffSizeLimit?: number
} & (
    | {
          workPolicy: 'after-add'
      }
    | {
          workPolicy: 'async-cycle-one'
          interval?: number
      }
    | {
          workPolicy: 'async-cycle-many'
          groupSize: number
          interval?: number
      }
    | {
          workPolicy?: undefined
      }
)
