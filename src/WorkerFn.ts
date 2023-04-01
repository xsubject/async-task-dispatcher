export type WorkerFn<T, R> = (item: T) => PromiseLike<R> | PromiseLike<R[]>
