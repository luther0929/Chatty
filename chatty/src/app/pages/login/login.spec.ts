import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { UserService } from '../../services/user-service/user-service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const userSpy = jasmine.createSpyObj('UserService', ['login', 'register']);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [Login, FormsModule],
      providers: [
        { provide: UserService, useValue: userSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    userServiceSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle between login and signup mode', () => {
    expect(component.isSignUpMode).toBe(false);
    component.toggleMode();
    expect(component.isSignUpMode).toBe(true);
    component.toggleMode();
    expect(component.isSignUpMode).toBe(false);
  });

  it('should validate password on input in signup mode', () => {
    component.isSignUpMode = true;
    component.password = 'weak';
    component.onPasswordInput();
    
    expect(component.showRequirements).toBe(true);
    expect(component.passwordRequirements.minLength).toBe(false);
  });

  it('should show all password requirements as met for strong password', () => {
    component.isSignUpMode = true;
    component.password = 'Strong123!';
    component.validatePasswordClient('Strong123!');
    
    expect(component.passwordRequirements.minLength).toBe(true);
    expect(component.passwordRequirements.hasUpperCase).toBe(true);
    expect(component.passwordRequirements.hasLowerCase).toBe(true);
    expect(component.passwordRequirements.hasNumber).toBe(true);
    expect(component.passwordRequirements.hasSpecialChar).toBe(true);
  });

  it('should show error message for empty username', async () => {
    component.username = '';
    component.password = 'Password123!';
    
    await component.onSubmit();
    
    expect(component.errorMessage).toBe('Please enter a username');
  });

  it('should show error message for empty password', async () => {
    component.username = 'testuser';
    component.password = '';
    
    await component.onSubmit();
    
    expect(component.errorMessage).toBe('Please enter a password');
  });

  it('should call login service on login submit', async () => {
    component.isSignUpMode = false;
    component.username = 'testuser';
    component.password = 'Password123!';
    
    userServiceSpy.login.and.returnValue(Promise.resolve({ success: true }));
    
    await component.onSubmit();
    
    expect(userServiceSpy.login).toHaveBeenCalledWith('testuser', 'Password123!');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/current-groups']);
  });

  it('should call register service on signup submit', async () => {
    component.isSignUpMode = true;
    component.username = 'newuser';
    component.password = 'Password123!';
    
    userServiceSpy.register.and.returnValue(Promise.resolve({ success: true }));
    
    await component.onSubmit();
    
    expect(userServiceSpy.register).toHaveBeenCalledWith('newuser', 'Password123!');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/current-groups']);
  });

  it('should show error on failed login', async () => {
    component.isSignUpMode = false;
    component.username = 'testuser';
    component.password = 'wrong';
    
    userServiceSpy.login.and.returnValue(Promise.resolve({ 
      success: false, 
      error: 'Invalid credentials' 
    }));
    
    await component.onSubmit();
    
    expect(component.errorMessage).toBe('Invalid credentials');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});