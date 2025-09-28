import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GroupService } from '../group-service/group-service';
import { HttpClient } from '@angular/common/http';
import { User } from '../../models/user';
import { Sockets } from '../sockets/sockets';

const USERS: User[] = [
  {
    id: '1',
    username: 'super',
    email: 'super@example.com',
    password: '123',
    roles: ['superAdmin'],
    groups: []
  },
  {
    id: '2',
    username: 'alice',
    email: 'alice@example.com',
    password: '123',
    roles: ['chatUser'],
    groups: []
  },
  {
    id: '3',
    username: 'bob',
    email: 'bob@example.com',
    password: '123',
    roles: ['chatUser', 'groupAdmin'],
    groups: []
  },
  {
    id: '4',
    username: 'charlie',
    email: 'charlie@example.com',
    password: '123',
    roles: ['chatUser'],
    groups: []
  },
  {
    id: '5',
    username: 'john',
    email: 'john@example.com',
    password: '123',
    roles: ['chatUser', 'groupAdmin'],
    groups: []
  },
  {
    id: '6',
    username: 'luther',
    email: 'luther@example.com',
    password: '123',
    roles: ['chatUser', 'groupAdmin'],
    groups: []
  },
  {
    id: '7',
    username: 'ben',
    email: 'ben@example.com',
    password: '123',
    roles: ['chatUser'],
    groups: []
  },
  {
    id: '8',
    username: 'jane',
    email: 'jane@example.com',
    password: '123',
    roles: ['chatUser'],
    groups: []
  },
  {
    id: '8',
    username: 'groupAdmin',
    email: 'groupAdmin@example.com',
    password: '123',
    roles: ['chatUser'],
    groups: []
  },
];


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

  getAllUsers(): User[] {
    return [...USERS];  // return a copy of the hardcoded USERS array
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


  deleteCurrentUser() {
    const user = this.getCurrentUser();
    if (!user) return;

    // Remove from USERS array
    const index = USERS.findIndex(u => u.username === user.username);
    if (index !== -1) {
      USERS.splice(index, 1);
    }

    // Tell backend to clean up group memberships
    this.sockets.emit('users:delete', user.username);

    // Clear state + storage
    this.logout();
  }

  

}
