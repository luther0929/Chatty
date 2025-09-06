import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user-service/user-service';

export const authGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  const user = userService.getCurrentUser();

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  const requiredRoles = route.data['roles'] as Array<string> | undefined;

  if (requiredRoles && !requiredRoles.some(role => user.roles.includes(role))) {
    alert('Access denied');
    router.navigate(['/login']);
    userService.logout();
    return false;
  }

  return true;

};
