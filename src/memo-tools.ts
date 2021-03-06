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

export class StrongMemo<K, V> extends MapMemo<K, V> {
  constructor(factory: (key: K) => V) {
    super(new Map<K, V>(), factory)
  }
}

class MemoValue<T> {
  private expiresAt?: number
  constructor(public value: T, ttl?: number) {
    if (ttl) {
      this.expiresAt = Date.now() + ttl
    }
  }
  isActive(): boolean {
    return !!this.expiresAt && Date.now() > this.expiresAt
  }
}

export class MemoSlot<T> {
  private state: MemoValue<T> | undefined
  private ttl?: number
  constructor(options: { ttl?: number } = {}) {
    this.ttl = options.ttl
  }
  getOrCreate(factory: () => T): T {
    if (!this.state?.isActive()) {
      this.state = new MemoValue(factory(), this.ttl)
    }
    return this.state.value
  }
  set(value: T): void {
    this.state = new MemoValue(value, this.ttl)
  }
  get() {
    return this.state?.value
  }
}
