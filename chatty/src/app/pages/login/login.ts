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

  constructor(private router: Router) {}

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
  }

  async onSubmit() {
    if (this.isSignUpMode) {
      const success = await this.userService.register(this.username, this.password);
      if (success) {
        this.router.navigate(['/current-groups']);
      } else {
        alert('Username already exists');
      }
    } else {
      const success = await this.userService.login(this.username, this.password);
      if (success) {
        this.router.navigate(['/current-groups']);
      } else {
        alert('Invalid credentials');
      }
    }
  }
}
