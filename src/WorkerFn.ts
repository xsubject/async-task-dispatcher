export type WorkerFn<T, R> = (item: T) => Promise<R> | Promise<R[]> | R | R[]
