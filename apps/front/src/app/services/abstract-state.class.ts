import {
  Signal,
  WritableSignal,
  computed,
  effect,
  signal,
} from '@angular/core';

import { StateConfig } from '../models/state.model';

/**
 * Abstract class for managing states with signals
 *
 * @template T - state type
 * @param {StateConfig<T>} options - configuration object
 */
export abstract class AbstractState<T> {
  readonly #state!: WritableSignal<T>;

  #stateName: StateConfig<T>['stateName'];
  #defaultState: T;
  #storageApi: StateConfig<T>['storageApi'];
  #storageKey: string;

  constructor(options: StateConfig<T>) {
    this.#stateName = options.stateName;
    this.#defaultState = options.defaultState;
    this.#storageApi = options.storageApi;
    this.#storageKey = `State_${this.#stateName}`;

    this.#state = signal<T>(this.#getCache());

    effect(() => {
      this.#cacheState(this.#state());
    });
  }
  /**
   * Select a value from the state or the whole state
   *
   * @param [key] - key of the value to select or empty to select the whole state
   * @returns Signal<T> | Signal<T[K]>
   */
  select(): Signal<T>;
  select<K extends keyof T>(key: K): Signal<T[K]>;
  select<K extends keyof T>(key?: keyof T): Signal<T> | Signal<T[K]> {
    if (key) {
      return computed(() => this.#state()[key]) as Signal<T[K]>;
    }
    return computed(() => this.#state()) as Signal<T>;
  }

  /**
   * Get a value from the state or the whole state
   *
   * @param [key] - key of the value to select or empty to select the whole state
   * @returns T | T[K]
   */
  get(): T;
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key?: keyof T): T | T[K] {
    if (key) {
      return this.#state()[key] as T[K];
    }
    return this.#state() as T;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    if (this.#storageApi) {
      window[this.#storageApi].removeItem(this.#storageKey);
    }
  }

  /**
   * Update the state with a new value
   *
   * @param {Function} updateFn - function that takes the current state and returns a new state
   */
  protected update(updateFn: (value: T) => T) {
    this.#state.update(updateFn);
  }

  #cacheState(state: T) {
    if (this.#storageApi) {
      window[this.#storageApi].setItem(this.#storageKey, JSON.stringify(state));
    }
  }

  #getCache(): T {
    let cache = this.#defaultState;
    if (this.#storageApi) {
      cache =
        this.#parse<T>(window[this.#storageApi].getItem(this.#storageKey)) ||
        this.#defaultState;
    }
    return cache;
  }

  #parse<S>(objStr: string | null): S | null {
    return objStr !== null ? (JSON.parse(objStr) as S) : objStr;
  }
}
