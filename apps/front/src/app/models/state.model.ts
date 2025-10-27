export interface StateConfig<T> {
  stateName: string;
  defaultState: T;
  storageApi?: keyof Window & ('localStorage' | 'sessionStorage');
}
