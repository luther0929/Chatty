import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GroupService } from '../group-service/group-service';
import { HttpClient } from '@angular/common/http';
import { User } from '../../models/user';
import { Sockets } from '../sockets/sockets';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private sockets = inject(Sockets)
  private groupService = inject(GroupService);
  private currentUser: User | null = null;
  private apiUrl = 'http://localhost:3000/api/users';

  constructor(private router: Router, private http: HttpClient) {
    const sockets = inject(Sockets);

    sockets.on<{ username: string; role: string }>('users:roleUpdate', (data) => {
      // Only update if THIS logged-in user matches the event
      if (this.currentUser && this.currentUser.username === data.username) {
        if (!this.currentUser.roles.includes(data.role)) {
          this.currentUser.roles = [...this.currentUser.roles, data.role];
          sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
      }
    });
  }


  async login(username: string, password: string): Promise<boolean> {
    try {
      const user = await this.http.post<User>(`${this.apiUrl}/login`, { username, password }).toPromise();
      if (user) {
        this.currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Login failed", err);
      return false;
    }
  }

  logout() {
    this.currentUser = null;
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    const data = sessionStorage.getItem('currentUser');
    return data ? JSON.parse(data) : null;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  async getAllUsers(): Promise<User[]> {
    return await lastValueFrom(this.http.get<User[]>(this.apiUrl));
  }

  async register(username: string, password: string, email?: string): Promise<boolean> {
    try {
      const user = await this.http.post<User>(`${this.apiUrl}/register`, { username, email, password }).toPromise();
      if (user) {
        this.currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Register failed", err);
      return false;
    }
  }

  async deleteCurrentUser() {
    const user = this.getCurrentUser();
    if (!user) return;

    await this.http.delete(`${this.apiUrl}/${user.username}`).toPromise();
    this.sockets.emit('users:delete', user.username);
    this.logout();
  }

  async uploadAvatar(username: string, file: File): Promise<User | null> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('avatar', file);

    try {
      const updated = await this.http
        .post<User>('http://localhost:3000/api/users/avatar', formData)
        .toPromise();

      if (updated !== undefined && updated !== null) {  // ✅ check both
        this.currentUser = updated;
        sessionStorage.setItem('currentUser', JSON.stringify(updated));
        return updated;
      } else {
        return null;
      }
    } catch (err) {
      console.error("Avatar upload failed", err);
      return null;
    }
  }
}
