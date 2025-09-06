import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';

@Component({
  selector: 'app-super-dashboard',
  imports: [FormsModule],
  templateUrl: './super-dashboard.html',
  styleUrl: './super-dashboard.css'
})
export class SuperDashboard {
  private groupService = inject(GroupService);
  private userService = inject(UserService);

  groupName = signal('');

  get groups() {
    return this.groupService.groups();
  }

  addGroup() {
    const name = this.groupName().trim();
    if (!name) return;
    const admins = [this.userService.getCurrentUser()?.username || 'unknown'];
    const current = this.userService.getCurrentUser();
    const members = [''];

    this.groupService.createGroup(name, current?.username || 'unknwon', admins, members);
    this.groupName.set('');
  }

  deleteGroup(id: string) {
    this.groupService.deleteGroup(id);
  }

  promoteUser(groupId: string, username: string, role: string) {
    this.groupService.promoteUser(username, role, groupId);
  }

  get superAdmins(): string[] {
    return this.userService
      .getAllUsers()
      .filter(u => u.roles.includes('superAdmin'))
      .map(u => u.username);
  }

  removeMember(groupId: string, username: string) {
    this.groupService.removeMember(groupId, username);
  }

}
