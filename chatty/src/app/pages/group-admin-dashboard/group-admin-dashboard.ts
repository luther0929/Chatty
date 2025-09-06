import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-group-admin-dashboard',
  imports: [FormsModule],
  templateUrl: './group-admin-dashboard.html',
  styleUrl: './group-admin-dashboard.css'
})

export class GroupAdminDashboard {
  private groupService = inject(GroupService);
  private userService = inject(UserService);
  private router = inject(Router);

  groupName = signal('');
  
  get groups() {
    return this.groupService.groups();
  }

  get currentUser() {
    return this.userService.getCurrentUser();
  }

  addGroup() {
    const name = this.groupName().trim();
    if (!name) return;

    const current = this.userService.getCurrentUser();
    const admins = [current?.username || 'unknown'];
    const members = [''];

    this.groupService.createGroup(name, current?.username || 'unknown', admins, members);

    this.groupName.set('');
  }

  
  deleteGroup(groupId: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.deleteGroup(groupId, current.username, current.roles[0]); // pass role
    }
  }

  removeMember(groupId: string, username: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.removeMember(groupId, username, current.username, current.roles[0]); // pass role
    }
  }

  banMember(groupId: string, username: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.banMember(groupId, username, current.username, current.roles[0]);
    }
  }

  createChannel(groupId: string, channelName: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.createChannel(groupId, channelName, current.username, current.roles[0]);
    }
  }

  deleteChannel(groupId: string, channelId: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.deleteChannel(groupId, channelId, current.username, current.roles[0]);
    }
  }

  reportMember(groupId: string, member: string, text: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.createReport(groupId, member, current.username, text);
    }
  }

  approveJoin(groupId: string, username: string) {
    const currentUser = this.userService.getCurrentUser();
    if (currentUser) {
      this.groupService.approveJoin(groupId, username, currentUser.username);
    }
  }

  declineJoin(groupId: string, username: string) {
    const currentUser = this.userService.getCurrentUser();
    if (currentUser) {
      this.groupService.declineJoin(groupId, username, currentUser.username);
    }
  }

  goBack() {
    this.router.navigate(['/current-groups']);
  }

}
