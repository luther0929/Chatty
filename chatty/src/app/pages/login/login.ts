import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user-service/user-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private userService = inject(UserService);
  username = signal('');
  password = signal('')

  constructor(private router: Router) {}

  onSubmit() {
    if (this.userService.login(this.username(), this.password())) {
      this.router.navigate(['/current-groups']);
    } else {
      alert('Invalid credentials');
    }
  }

}
