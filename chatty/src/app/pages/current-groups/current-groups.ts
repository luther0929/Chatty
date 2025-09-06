import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UserService} from '../../services/user-service/user-service';
import { User } from '../../models/user';
import { GroupService } from '../../services/group-service/group-service';
import { Group as GroupModel } from '../../models/group';

@Component({
  selector: 'app-current-groups',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './current-groups.html',
  styleUrl: './current-groups.css'
})
export class CurrentGroups {
  private userService = inject(UserService);
  private groupService = inject(GroupService);

  user = signal<User | null>(this.userService.getCurrentUser());

  get currentUser() {
    return this.userService.getCurrentUser();
  }

  get myGroups(): GroupModel[] {
    const current = this.user();
    if (!current) return [];

    return this.groupService.getGroups().filter(g =>
      (g.members?.includes(current.username)) ||
      (g.admins?.includes(current.username))
    );
  }

  get availableGroups(): GroupModel[] {
    const current = this.user();
    if (!current) return [];

    return this.groupService.getGroups().filter(g =>
      !(g.members?.includes(current.username)) &&
      !(g.admins?.includes(current.username))
    );
  }

  promote(groupId: string, username: string) {
    this.groupService.promoteToAdmin(groupId, username);
  }

  get adminDashboardRoute(): string | null {
    const current = this.userService.getCurrentUser();
    if (!current) return null;

    if (current.roles.includes('superAdmin')) {
      return '/super-dashboard';
    } else if (current.roles.includes('groupAdmin')) {
      return '/group-admin-dashboard';
    }
    return null;
  }

  leaveGroup(groupId: string) {
    const user = this.userService.getCurrentUser();
    if (!user) return;
    this.groupService.leaveGroup(groupId, user.username);
  }

  requestJoin(groupId: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.requestJoinGroup(groupId, current.username);
    }
  }

  logout() {
    this.userService.logout(); // clear signal + localStorage
  }

}
