import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../../models/user.model';
import {Role} from '../../models/Enum/role.enum';

@Injectable({ providedIn: 'root' })
export class UserService {
  private base = '/api/users';

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/allUsers`);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.base}/user/${id}`);
  }

  create(user: User): Observable<User> {
    return this.http.post<User>(`${this.base}/createUser`, user);
  }

  update(
    id: string,
    payload: Omit<Partial<User>, 'roles'> & {
      password?: string;
      roles?: (Role | string)[];   // allow either enum values or raw strings
      organizationId?: string;
    }
  ): Observable<User> {
    return this.http.put<User>(`${this.base}/updateUser/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/deleteUser/${id}`);
  }
}
