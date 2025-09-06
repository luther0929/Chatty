import { Injectable, signal, inject } from '@angular/core';
import { Group } from '../../models/group';
import { Sockets } from '../sockets/sockets';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private storageKey = 'groups';
  private socket = inject(Sockets);
  groups = signal<Group[]>([]);

  constructor(private sockets: Sockets) {
    this.sockets.listenForGroups((groups) => {
      this.groups.set(groups);
    });
  }

  createGroup(name: string, createdBy: string, admins: string[], members: string[]) {
    const newGroup = { id: crypto.randomUUID(), name, createdBy, admins, members: [] };
    this.socket.emit('groups:create', newGroup);
  }

  deleteGroup(groupId: string, performedBy: string, role: string) {
    this.socket.emit('groups:delete', { groupId, performedBy, role });
  }

  getGroups(): Group[] {
    return this.groups();
  }

  joinGroup(groupId: string, username: string) {
    this.socket.emit('groups:join', { groupId, username });
  }

  promoteToAdmin(groupId: string, username: string) {
    this.socket.emit('groups:promote', { groupId, username });
  }

  promoteUser(username: string, role: string, groupId?: string) {
    this.socket.emit('users:promote', { username, role, groupId });
  }

  removeMember(groupId: string, username: string, performedBy: string, role: string) {
    this.socket.emit('groups:removeMember', { groupId, username, performedBy, role });
  }

  banMember(groupId: string, username: string, performedBy: string, role: string) {
    this.socket.emit('groups:ban', { groupId, username, performedBy, role });
  }

  createChannel(groupId: string, channelName: string, performedBy: string, role: string) {
    const channel = {
      id: crypto.randomUUID(),
      name: channelName,
      users: []
    };

    this.socket.emit('channels:create', { groupId, channel, performedBy, role });
  }

  deleteChannel(groupId: string, channelId: string, performedBy: string, role: string) {
    this.socket.emit('channels:delete', { groupId, channelId, performedBy, role });
  }

  createReport(groupId: string, member: string, reportedBy: string, text: string) {
    this.socket.emit('reports:create', { groupId, member, reportedBy, text });
  }

  listenForReports(callback: (reports: Report[]) => void) {
    this.socket.on('reports:update', callback);
  }

}
