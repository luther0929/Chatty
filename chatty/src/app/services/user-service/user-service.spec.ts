import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user-service';
import { Router } from '@angular/router';
import { Sockets } from '../sockets/sockets';
import { User } from '../../models/user';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let socketsSpy: jasmine.SpyObj<Sockets>;

  beforeEach(() => {
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);
    const socketsSpyObj = jasmine.createSpyObj('Sockets', ['emit', 'on']);
    
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserService,
        { provide: Router, useValue: routerSpyObj },
        { provide: Sockets, useValue: socketsSpyObj }
      ]
    });
    
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    socketsSpy = TestBed.inject(Sockets) as jasmine.SpyObj<Sockets>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should successfully login with valid credentials', async () => {
    const mockUser: User = { 
      id: '1', 
      username: 'testuser', 
      email: 'test@test.com',
      password: '',
      roles: ['chatUser'], 
      groups: []
    };
    
    const loginPromise = service.login('testuser', 'Password123!');
    
    const req = httpMock.expectOne('http://localhost:3000/api/users/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'testuser', password: 'Password123!' });
    req.flush(mockUser);
    
    const result = await loginPromise;
    expect(result.success).toBe(true);
    expect(service.getCurrentUser()).toEqual(mockUser);
  });

  it('should fail login with invalid credentials', async () => {
    const loginPromise = service.login('wrong', 'wrong');
    
    const req = httpMock.expectOne('http://localhost:3000/api/users/login');
    req.flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    
    const result = await loginPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid credentials');
  });

  it('should successfully register a new user', async () => {
    const mockUser = { 
      id: '2', 
      username: 'newuser', 
      email: 'new@test.com', 
      roles: ['chatUser'], 
      groups: [] 
    };
    
    const registerPromise = service.register('newuser', 'Password123!', 'new@test.com');
    
    const req = httpMock.expectOne('http://localhost:3000/api/users/register');
    expect(req.request.method).toBe('POST');
    req.flush(mockUser);
    
    const result = await registerPromise;
    expect(result.success).toBe(true);
  });

  it('should fail registration with weak password', async () => {
    const registerPromise = service.register('newuser', 'weak', 'new@test.com');
    
    const req = httpMock.expectOne('http://localhost:3000/api/users/register');
    req.flush(
      { error: 'Password must be at least 8 characters long' }, 
      { status: 400, statusText: 'Bad Request' }
    );
    
    const result = await registerPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('Password must be at least 8 characters long');
  });

  it('should logout and clear session', () => {
    service.logout();
    expect(service.getCurrentUser()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should return current user from session storage', () => {
    const mockUser: User = { 
      id: '1', 
      username: 'testuser', 
      email: 'test@test.com',
      password: '',
      roles: ['chatUser'], 
      groups: []
    };
    
    sessionStorage.setItem('currentUser', JSON.stringify(mockUser));
    
    const user = service.getCurrentUser();
    expect(user).toEqual(mockUser);
    
    sessionStorage.clear();
  });

  it('should return all users', async () => {
    const mockUsers: User[] = [
      { id: '1', username: 'user1', email: 'u1@test.com', password: '', roles: ['chatUser'], groups: [] },
      { id: '2', username: 'user2', email: 'u2@test.com', password: '', roles: ['chatUser'], groups: [] }
    ];
    
    const usersPromise = service.getAllUsers();
    
    const req = httpMock.expectOne('http://localhost:3000/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
    
    const users = await usersPromise;
    expect(users.length).toBe(2);
    expect(users).toEqual(mockUsers);
  });
});