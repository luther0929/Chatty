import { Injectable, signal, inject } from '@angular/core';
import { Group } from '../../models/group';
import { Sockets } from '../sockets/sockets';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private storageKey = 'groups';
  private socket = inject(Sockets);
  groups = signal<Group[]>([]);
  messages = signal<any[]>([]);
  currentChannel = signal<{ groupId: string; channelId: string; channelName: string } | null>(null);

  constructor(private sockets: Sockets) {
    this.sockets.listenForGroups((groups) => this.groups.set(groups));
    this.sockets.on('channels:loadMessages', (msgs: any[]) => {
      this.messages.set(msgs);
    });
    this.sockets.emit('groups:getAll')
    this.listenForMessages();
  }

  initialize() {
    this.sockets.emit('groups:getAll'); // ask server for full state
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

  requestJoinGroup(groupId: string, username: string) {
    this.sockets.emit('groups:requestJoin', { groupId, username });
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

  joinChannel(groupId: string, channelId: string, channelName: string, username: string) {
    this.sockets.emit('channels:join', { groupId, channelId, username });
    this.currentChannel.set({ groupId, channelId, channelName });
    this.messages.set([]); // reset messages when entering new channel

    // ask server for stored messages
    this.sockets.emit('channels:getMessages', { groupId, channelId });
  }

  leaveGroup(groupId: string, username: string) {
    this.sockets.emit('groups:leave', { groupId, username });
  }

  leaveChannel() {
    this.sockets.emit('channels:leave');
    this.currentChannel.set(null);
    this.messages.set([]);
  }

  sendMessage(groupId: string, channelId: string, username: string, text: string) {
    this.sockets.emit('channels:message', { groupId, channelId, username, text });
  }

  listenForMessages() {
    this.sockets.on('channels:message', (msg: any) => {
      this.messages.update((m) => [...m, msg]);
    });
    this.sockets.on('channels:system', (msg: any) => {
      this.messages.update((m) => [...m, msg]);
    });
  }

  approveJoin(groupId: string, username: string, actingUser: string) {
    this.sockets.emit('groups:approveJoin', {
      groupId,
      username,
      actingUser
    });
  }


  declineJoin(groupId: string, username: string, actingUser: string) {
    this.sockets.emit('groups:declineJoin', {
      groupId,
      username,
      actingUser
    });
  }

}
