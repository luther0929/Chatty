import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getGroups() {
    return this.http.get<any[]>('http://localhost:3000/api/groups');
  }

  getUsers() {
    return this.http.get<any[]>('http://localhost:3000/api/users');
  }
}
