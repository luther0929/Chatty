import { Injectable, signal, inject } from '@angular/core';
import { Group } from '../../models/group';
import { Report } from '../../models/report';
import { Sockets } from '../sockets/sockets';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private socket = inject(Sockets);

  // Signals for reactive state
  groups = signal<Group[]>([]);
  messages = signal<any[]>([]);
  currentChannel = signal<{ groupId: string; channelId: string; channelName: string } | null>(null);

  constructor() {
    // Listen for server updates
    this.socket.on('groups:update', (groups: Group[]) => this.groups.set(groups));
    this.socket.on('channels:loadMessages', (msgs: any[]) => this.messages.set(msgs));

    this.listenForMessages();

    // Initialize by requesting all groups from server
    this.initialize();
  }

  /** Ask server for full state of groups */
  initialize() {
    this.socket.emit('groups:getAll');
  }

  /** --------- GROUP MANAGEMENT --------- */
  createGroup(name: string, createdBy: string, admins: string[], members: string[]) {
  const newGroup: Group = {
    id: crypto.randomUUID(),
    name,
    createdBy,
    admins,
    members: members ?? [],
    bannedMembers: [],   // required by Group model
    channels: [],        // start with no channels
    joinRequests: []     // start with no pending requests
  };
  this.socket.emit('groups:create', newGroup);
}


  deleteGroup(groupId: string, performedBy: string, role: string) {
    this.socket.emit('groups:delete', { groupId, performedBy, role });
  }

  requestJoinGroup(groupId: string, username: string) {
    this.socket.emit('groups:requestJoin', { groupId, username });
  }

  approveJoin(groupId: string, username: string, actingUser: string) {
    this.socket.emit('groups:approveJoin', { groupId, username, actingUser });
  }

  declineJoin(groupId: string, username: string, actingUser: string) {
    this.socket.emit('groups:declineJoin', { groupId, username, actingUser });
  }

  leaveGroup(groupId: string, username: string) {
    this.socket.emit('groups:leave', { groupId, username });
  }

  /** --------- USER MANAGEMENT --------- */
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

  /** --------- CHANNEL MANAGEMENT --------- */
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

  joinChannel(groupId: string, channelId: string, channelName: string, username: string) {
    this.socket.emit('channels:join', { groupId, channelId, username });
    this.currentChannel.set({ groupId, channelId, channelName });
    this.messages.set([]); // reset messages when switching channel

    // Fetch stored messages from server
    this.socket.emit('channels:getMessages', { groupId, channelId });
  }

  leaveChannel() {
    this.socket.emit('channels:leave');
    this.currentChannel.set(null);
    this.messages.set([]);
  }

  /** --------- MESSAGING --------- */
  sendMessage(groupId: string, channelId: string, username: string, text: string) {
    this.socket.emit('channels:message', { groupId, channelId, username, text });
  }

  private listenForMessages() {
    this.socket.on('channels:message', (msg: any) => {
      this.messages.update((m) => [...m, msg]);
    });
    this.socket.on('channels:system', (msg: any) => {
      this.messages.update((m) => [...m, msg]);
    });
  }

  /** --------- REPORTING --------- */
  createReport(groupId: string, member: string, reportedBy: string, text: string) {
    this.socket.emit('reports:create', { groupId, member, reportedBy, text });
  }

  listenForReports(callback: (reports: Report[]) => void) {
    this.socket.on('reports:update', callback);
  }

  /** --------- HELPERS --------- */
  getGroups(): Group[] {
    return this.groups();
  }
}
