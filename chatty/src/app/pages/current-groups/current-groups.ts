import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UserService} from '../../services/user-service/user-service';
import { User } from '../../models/user';
import { GroupService } from '../../services/group-service/group-service';
import { Group as GroupModel } from '../../models/group';
import { ApiService } from '../../services/api-service/api-service';

@Component({
  selector: 'app-current-groups',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './current-groups.html',
  styleUrl: './current-groups.css'
})
export class CurrentGroups implements OnInit{
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  groups: any[] = [];
  user = signal<User | null>(this.userService.getCurrentUser());

  constructor(private api: ApiService) {}

  ngOnInit() {
    // Load once via REST API
    this.api.getGroups().subscribe((groups) => {
      console.log("Loaded via REST:", groups);
      this.groups = groups;
    });
  }

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

  deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.userService.deleteCurrentUser();
    }
  }

  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const currentUser = this.userService.getCurrentUser();

    if (currentUser) {
      const updated = await this.userService.uploadAvatar(currentUser.username, file);
      if (updated) {
        // ✅ Add cache busting here too
        updated.avatar = updated.avatar + '?t=' + Date.now();

        this.user.set(updated); 
        console.log("✅ Avatar updated immediately:", updated);
      }
    }
  }

  get avatarUrl(): string {
    const user = this.user();
    if (user && user.avatar) {
      return 'http://localhost:3000' + user.avatar + '?t=' + Date.now();
    }
    return 'assets/avatar-placeholder.png';
  }

}
