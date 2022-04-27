type AnyHandler = (...args: any[]) => (() => any) | undefined

export class ChainOfResponsibility<F extends AnyHandler> {
  private handlers: F[] = []
  constructor(private fallback?: F) {}
  add(handler: F) {
    this.handlers.push(handler)
  }
  getHandler(...args: Parameters<F>): ReturnType<F> | undefined {
    for (const handler of this.handlers) {
      const result = handler(...args)
      if (result) {
        return result as ReturnType<F>
      }
    }
    if (this.fallback) {
      return this.fallback(...args) as ReturnType<F>
    }
  }
  handle(...args: Parameters<F>): ResultOf<F> | undefined {
    const handler = this.getHandler(...args)
    if (handler) {
      return handler()
    }
  }
}

type ResultOf<F extends AnyHandler> = ReturnType<
  Exclude<ReturnType<F>, undefined>
>
