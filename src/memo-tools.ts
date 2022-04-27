export class WeakMemo<K extends object, V> {
  private readonly map = new WeakMap<K, V>()
  constructor(private readonly factory: (key: K) => V) {}
  get(key: K): V {
    if (!this.map.has(key)) {
      this.map.set(key, this.factory(key))
    }
    return this.map.get(key) as V
  }
}

export class StrongMemo<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly factory: (key: K) => V) {}
  get(key: K): V {
    if (!this.map.has(key)) {
      this.map.set(key, this.factory(key))
    }
    return this.map.get(key) as V
  }
}

export class MemoValue<T> {
  constructor(public value: T) {}
}

export class MemoSlot<T> {
  private state: MemoValue<T> | undefined
  constructor() {}
  getOrCreate(factory: () => T): T {
    if (this.state === undefined) {
      this.state = new MemoValue(factory())
    }
    return this.state.value
  }
}
