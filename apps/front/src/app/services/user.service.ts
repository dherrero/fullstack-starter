import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PaginationDTO, UserDTO } from '@dto';
import { env } from '@front/environments/environment';
import { AbstractState } from './abstract-state.class';

interface UserState {
  loading: boolean;
  users: UserDTO[];
}

@Injectable({
  providedIn: 'root',
})
export class UserService extends AbstractState<UserState> {
  #http = inject(HttpClient);
  #userApi = 'user/';
  loading = this.select('loading');
  users = this.select('users');

  constructor() {
    super({
      stateName: 'User',
      defaultState: {
        loading: false,
        users: [],
      },
    });
  }

  listUsers(page = 1, limit = 10) {
    return this.#http.get<PaginationDTO<UserDTO>>(
      env.api + this.#userApi + 'paged',
      {
        params: this.#setParams({ page, limit }),
      }
    );
  }

  getUserById(id: number) {
    return this.#http.get<UserDTO>(env.api + this.#userApi + id);
  }

  createUser(user: Partial<UserDTO>) {
    return this.#http.post<UserDTO>(env.api + this.#userApi, user);
  }

  updateUser(id: number, user: Partial<UserDTO>) {
    return this.#http.put<UserDTO>(env.api + this.#userApi + id, user);
  }

  deleteUser(id: number) {
    return this.#http.delete<void>(env.api + this.#userApi + id);
  }

  #setParams(params: Record<string, string | number>) {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  }
}
