export class ChainOfResponsibility<F extends ChainOfResponsibilityHandler> {
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
  handle(...args: Parameters<F>): ChainOfResponsibilityResultOf<F> | undefined {
    const handler = this.getHandler(...args)
    if (handler) {
      return handler()
    }
  }
}

export type ChainOfResponsibilityHandler = (
  ...args: any[]
) => (() => any) | undefined

export type ChainOfResponsibilityResultOf<
  F extends ChainOfResponsibilityHandler,
> = ReturnType<Exclude<ReturnType<F>, undefined>>
