import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user-service/user-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],  
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private userService = inject(UserService);
  username: string = '';
  password: string = '';
  isSignUpMode = false;

  errorMessage: string = '';
  passwordRequirements = {
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  };
  showRequirements = false;

  constructor(private router: Router) {}

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
    this.showRequirements = false;
    this.password = '';
  }

  validatePasswordClient(password: string): boolean {
    this.passwordRequirements.minLength = password.length >= 8;
    this.passwordRequirements.hasUpperCase = /[A-Z]/.test(password);
    this.passwordRequirements.hasLowerCase = /[a-z]/.test(password);
    this.passwordRequirements.hasNumber = /\d/.test(password);
    this.passwordRequirements.hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return Object.values(this.passwordRequirements).every(req => req);
  }

  onPasswordInput() {
    if (this.isSignUpMode && this.password.length > 0) {
      this.showRequirements = true;
      this.validatePasswordClient(this.password);
    } else {
      this.showRequirements = false;
    }
    this.errorMessage = '';
  }

  async onSubmit() {
    this.errorMessage = '';
    
    if (!this.username.trim()) {
      this.errorMessage = 'Please enter a username';
      return;
    }
    
    if (!this.password) {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.isSignUpMode) {
      // Validate password before sending to server
      if (!this.validatePasswordClient(this.password)) {
        this.errorMessage = 'Please meet all password requirements';
        this.showRequirements = true;
        return;
      }
      
      const result = await this.userService.register(this.username, this.password);
      if (result.success) {
        this.router.navigate(['/current-groups']);
      } else {
        this.errorMessage = result.error || 'Registration failed';
      }
    } else {
      const result = await this.userService.login(this.username, this.password);
      if (result.success) {
        this.router.navigate(['/current-groups']);
      } else {
        this.errorMessage = result.error || 'Invalid credentials';
      }
    }
  }
}
