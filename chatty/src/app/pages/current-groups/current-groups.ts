import { Component, inject, signal } from '@angular/core';
import { UserService} from '../../services/user-service/user-service';
import { User } from '../../models/user';
import { GroupService } from '../../services/group-service/group-service';
import { Group as GroupModel } from '../../models/group';

@Component({
  selector: 'app-current-groups',
  standalone: true,
  imports: [],
  templateUrl: './current-groups.html',
  styleUrl: './current-groups.css'
})
export class CurrentGroups {
  private userService = inject(UserService);
  private groupService = inject(GroupService);

  user = signal<User | null>(this.userService.getCurrentUser());

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


  joinGroup(groupId: string) {
    const current = this.user();
    if (current) {
      this.groupService.joinGroup(groupId, current.username);
    }
  }

  promote(groupId: string, username: string) {
    this.groupService.promoteToAdmin(groupId, username);
  }


}
