import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';
import { Report } from '../../models/report';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-super-dashboard',
  imports: [FormsModule, DatePipe],
  templateUrl: './super-dashboard.html',
  styleUrl: './super-dashboard.css'
})
export class SuperDashboard {
  private groupService = inject(GroupService);
  private userService = inject(UserService);

  groupName = signal('');
  reports = signal<Report[]>([]);

  constructor() {
    this.groupService.listenForReports((reports) => {
    this.reports.set(reports as unknown as Report[]);
  });
  }

  get groups() {
    return this.groupService.groups();
  }

  get currentUser() {
    return this.userService.getCurrentUser();
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

  deleteGroup(groupId: string) {
    const current = this.userService.getCurrentUser();
    if (current) {
      this.groupService.deleteGroup(groupId, current.username, current.roles[0]); // pass role
    }
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

}
