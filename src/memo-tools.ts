export interface MemoMap<K, V> {
  has(key: K): boolean
  get(key: K): V | undefined
  set(key: K, value: V): void
}

export class MapMemo<K, V> {
  constructor(
    protected map: MemoMap<K, V>,
    private readonly factory: (key: K) => V,
  ) {}
  get(key: K): V {
    if (!this.map.has(key)) {
      this.map.set(key, this.factory(key))
    }
    return this.map.get(key) as V
  }
}

export class WeakMemo<K extends object, V> extends MapMemo<K, V> {
  constructor(factory: (key: K) => V) {
    super(new WeakMap<K, V>(), factory)
  }
}

export class StrongMemo<K extends object, V> extends MapMemo<K, V> {
  constructor(factory: (key: K) => V) {
    super(new Map<K, V>(), factory)
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
