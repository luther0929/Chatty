import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';   // ✅ import NgIf
import { UserService } from '../../services/user-service/user-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NgIf],   // ✅ add NgIf here
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private userService = inject(UserService);
  username: string = '';
  password: string = '';
  isSignUpMode = false;

  constructor(private router: Router) {}

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
  }

  onSubmit() {
    if (this.isSignUpMode) {
      if (this.userService.register(this.username, this.password)) {
        this.router.navigate(['/current-groups']);
      } else {
        alert('Username already exists');
      }
    } else {
      if (this.userService.login(this.username, this.password)) {
        this.router.navigate(['/current-groups']);
      } else {
        alert('Invalid credentials');
      }
    }
  }
}
