import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';
import { Report } from '../../models/report';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../models/user';

@Component({
  selector: 'app-super-dashboard',
  imports: [FormsModule, DatePipe],
  templateUrl: './super-dashboard.html',
  styleUrl: './super-dashboard.css'
})
export class SuperDashboard implements OnInit{
  private groupService = inject(GroupService);
  private userService = inject(UserService);
  private router = inject(Router);
  superAdmins: string[] = [];
  groupName = signal('');
  reports = signal<Report[]>([]);

  constructor() {
      this.groupService.listenForReports((reports) => {
        this.reports.set(reports as unknown as Report[]);
      });
  }

  async ngOnInit() {
    try {
      const users: User[] = await this.userService.getAllUsers();  // ✅ await Promise
      this.superAdmins = users
        .filter((u: User) => u.roles.includes('superAdmin'))
        .map((u: User) => u.username);
    } catch (err) {
      console.error('❌ Failed to load users', err);
    }
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
