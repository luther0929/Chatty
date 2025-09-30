import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupService = inject(GroupService);
  private userService = inject(UserService);

  groupId: string | null = null;
  messageText = signal('');

  initialOf(name?: string): string {
    const n = (name ?? '').trim();
    return n ? n[0].toUpperCase() : '?';
  }

  gradientCSS = 'linear-gradient(90deg, #6237A0, #9754CB)';

  channelUsers = computed(() => {
    const cc = this.currentChannel();        // triggers on channel change
    const groups = this.groupService.groups(); // triggers on server updates
    if (!cc) return [];
    const g = groups.find(g => g.id === cc.groupId);
    const ch = g?.channels.find(c => c.id === cc.channelId);
    return ch?.users ?? [];
  });

  channelUserCount = computed(() => this.channelUsers().length);

  group = computed(() => {
    if (!this.groupId) return null;
    return this.groupService.groups().find(g => g.id === this.groupId) || null;
  });

  messages = computed(() => this.groupService.messages());
  currentChannel = computed(() => this.groupService.currentChannel());

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.groupId = params.get('groupId');
      this.groupService.initialize(); // ✅ fetch groups from server on refresh
    });
  }

  get currentUser() {
    return this.userService.getCurrentUser();
  }


  joinChannel(channelId: string, channelName: string) {
    const user = this.userService.getCurrentUser();
    if (this.groupId && user) {
      this.groupService.joinChannel(this.groupId, channelId, channelName, user.username);
    }
  }


  sendMessage() {
    const text = this.messageText().trim();
    const user = this.userService.getCurrentUser();
    const channel = this.currentChannel();
    if (text && user && channel) {
      this.groupService.sendMessage(channel.groupId, channel.channelId, user.username, text, user.avatar);
      this.messageText.set('');
    }
  }

  goBack() {
    this.router.navigate(['/current-groups']);
  }

  getAvatarUrl(username: string, avatarPath?: string): string {
    if (avatarPath) {
      return 'http://localhost:3000' + avatarPath;
    }
    // ✅ Consistent fallback with server
    return 'http://localhost:3000/uploads/avatars/avatar-placeholder.png';
  }
}
