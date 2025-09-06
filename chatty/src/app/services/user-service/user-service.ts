import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GroupService } from '../group-service/group-service';
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
  private groupService = inject(GroupService);
  private currentUser: User | null = null;

  constructor(private router: Router) {
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


  login(username: string, password: string): boolean {
    const user = USERS.find(
      u => u.username === username && u.password === password
    );
    if (user) {
      this.currentUser = user;
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    localStorage.clear();                // extra safety
    sessionStorage.clear();              // clear session if used
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

  register(username: string, password: string): boolean {
    // check uniqueness
    const existing = USERS.find(u => u.username === username);
    if (existing) return false;

    const newUser: User = {
      id: (USERS.length + 1).toString(),
      username,
      email: `${username}@example.com`, // optional stub
      password,
      roles: ['chatUser'], // default role
      groups: []
    };

    USERS.push(newUser);
    this.currentUser = newUser;
    sessionStorage.setItem('currentUser', JSON.stringify(newUser));
    return true;
  }


}
