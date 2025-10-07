import { Component, inject, OnInit, OnDestroy, computed, signal, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { GroupService } from '../../services/group-service/group-service';
import { UserService } from '../../services/user-service/user-service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { VideoService } from '../../services/video-service/video-service';
import { Sockets } from '../../services/sockets/sockets';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupService = inject(GroupService);
  private userService = inject(UserService);
  private videoService = inject(VideoService);
  private sockets = inject(Sockets);
  private cdr = inject(ChangeDetectorRef);
  someoneElseScreensharing = signal(false);
  screenshareBlockedMessage = signal<string | null>(null);
  private currentScreenStream: MediaStream | null = null;

  groupId: string | null = null;
  selectedImage: File | null = null;
  selectedImagePreview: string | null = null;
  messageText = signal('');

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('localScreenShare') localScreenShare!: ElementRef<HTMLVideoElement>;

  isCameraOn = false;
  isScreenSharing = false;
  
  remotePeers = new Map<string, { username: string; stream: MediaStream | null; avatar?: string }>();
  remotePeerArray = signal<Array<{ peerId: string; username: string; stream: MediaStream | null; avatar?: string }>>([]);
  remoteScreenShares = new Map<string, { username: string; stream: MediaStream | null }>();
  remoteScreenShareArray = signal<Array<{ peerId: string; username: string; stream: MediaStream | null }>>([]);
  channelUsersData = signal<Map<string, { avatar?: string }>>(new Map());

  gradientCSS = 'linear-gradient(90deg, #6237A0, #9754CB)';

  channelUsers = computed(() => {
    const cc = this.currentChannel();
    const groups = this.groupService.groups();
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

  otherChannelUsers = computed(() => {
    const users = this.channelUsers();
    const currentUsername = this.currentUser?.username;
    return users.filter(u => u !== currentUsername);
  });

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.groupId = params.get('groupId');
      this.groupService.initialize();
    });

    const user = this.userService.getCurrentUser();
    if (user) {
      this.sockets.emit('user:register', { username: user.username });
    }

    await this.fetchAllUserAvatars();

    this.videoService.onRemoteStream((peerId, stream, username, avatar) => {
      console.log('Adding remote stream from', peerId, username, 'avatar:', avatar);
      this.remotePeers.set(peerId, { username, stream, avatar });
      this.remotePeerArray.set(Array.from(this.remotePeers.entries()).map(([id, data]) => ({
        peerId: id,
        ...data
      })));
      this.cdr.detectChanges();
    });

    this.videoService.onRemoveStream((peerId) => {
      console.log('Removing remote stream from', peerId);
      this.remotePeers.delete(peerId);
      this.remotePeerArray.set(Array.from(this.remotePeers.entries()).map(([id, data]) => ({
        peerId: id,
        ...data
      })));
      this.cdr.detectChanges();
    });

    this.videoService.onRemoteScreenShare((peerId, stream, username) => {
      console.log('Adding remote screenshare from', peerId, username);
      this.remoteScreenShares.set(peerId, { username, stream });
      this.remoteScreenShareArray.set(Array.from(this.remoteScreenShares.entries()).map(([id, data]) => ({
        peerId: id,
        ...data
      })));
      this.someoneElseScreensharing.set(true);
      this.cdr.detectChanges();
    });

    this.videoService.onRemoveScreenShare((peerId) => {
      console.log('Removing remote screenshare from', peerId);
      this.remoteScreenShares.delete(peerId);
      this.remoteScreenShareArray.set(Array.from(this.remoteScreenShares.entries()).map(([id, data]) => ({
        peerId: id,
        ...data
      })));
      this.someoneElseScreensharing.set(this.remoteScreenShares.size > 0);
      this.cdr.detectChanges();
    });

    this.videoService.onScreenshareBlocked((username) => {
      this.screenshareBlockedMessage.set(`${username} is currently screensharing`);
      
      // Stop the local stream if we tried to start one
      if (this.isScreenSharing && this.currentScreenStream) {
        this.currentScreenStream.getTracks().forEach(track => track.stop());
        this.isScreenSharing = false;
        if (this.localScreenShare && this.localScreenShare.nativeElement) {
          this.localScreenShare.nativeElement.srcObject = null;
        }
      }
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        this.screenshareBlockedMessage.set(null);
      }, 3000);
    });
  }

  async fetchAllUserAvatars() {
    try {
      const response = await fetch('http://localhost:3000/api/users');
      const users = await response.json();
      const usersMap = new Map<string, { avatar?: string }>();
      
      users.forEach((user: any) => {
        usersMap.set(user.username, { avatar: user.avatar });
      });
      
      this.channelUsersData.set(usersMap);
      console.log('Fetched user avatars:', usersMap);
    } catch (error) {
      console.error('Failed to fetch user avatars:', error);
    }
  }

  ngOnDestroy() {
    const channel = this.currentChannel();
    const user = this.currentUser;
    
    if (this.isCameraOn && channel && user) {
      this.videoService.stopBroadcast(channel.channelId, user.username, channel.groupId);
    }
    
    if (this.isScreenSharing && channel && user) {
      this.videoService.stopScreenShare(channel.channelId, user.username, channel.groupId);
    }
  }

  get currentUser() {
    return this.userService.getCurrentUser();
  }

  joinChannel(channelId: string, channelName: string) {
    const user = this.userService.getCurrentUser();
    if (this.groupId && user) {
      if (this.isCameraOn) {
        this.toggleCamera();
      }
      
      if (this.isScreenSharing) {
        this.toggleScreenShare();
      }
      
      this.groupService.joinChannel(this.groupId, channelId, channelName, user.username);
      
      this.remotePeers.clear();
      this.remotePeerArray.set([]);
      this.remoteScreenShares.clear();
      this.remoteScreenShareArray.set([]);
    }
  }

  getPeerDataByUsername(username: string): { peerId: string; username: string; stream: MediaStream | null; avatar?: string } | null {
    const peers = this.remotePeerArray();
    return peers.find(p => p.username === username) || null;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedImage = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.selectedImagePreview = reader.result as string;
      };
      reader.readAsDataURL(this.selectedImage);
    }
  }

  removeSelectedImage() {
    this.selectedImage = null;
    this.selectedImagePreview = null;

    const input = document.querySelector<HTMLInputElement>('#chat-image-input');
    if (input) input.value = '';
  }

  async sendMessage() {
    const text = this.messageText().trim();
    const user = this.userService.getCurrentUser();
    const channel = this.currentChannel();

    if (!user || !channel) return;

    let imageUrl: string | undefined;

    if (this.selectedImage) {
      const formData = new FormData();
      formData.append('image', this.selectedImage);

      const response: any = await fetch('http://localhost:3000/api/messages/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      imageUrl = result.imageUrl;
      this.selectedImage = null;
      this.selectedImagePreview = null;
    }

    if (text || imageUrl) {
      this.groupService.sendMessage(channel.groupId, channel.channelId, user.username, text, user.avatar, imageUrl);
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
    
    const userData = this.channelUsersData().get(username);
    if (userData?.avatar) {
      return 'http://localhost:3000' + userData.avatar;
    }
    
    return 'http://localhost:3000/uploads/avatars/avatar-placeholder.png';
  }

  get isScreenshareDisabled(): boolean {
    return this.someoneElseScreensharing() && !this.isScreenSharing;
  }

  async toggleCamera() {
    const channel = this.currentChannel();
    const user = this.currentUser;

    if (!channel || !user) {
      console.error("No active channel or user found");
      return;
    }

    if (!this.isCameraOn) {
      if (!this.videoService.isPeerReady()) {
        alert('Video connection not ready yet. Please wait a moment and try again.');
        return;
      }

      this.isCameraOn = true;

      const stream = await this.videoService.startBroadcast(
        channel.channelId, 
        user.username, 
        channel.groupId,
        user.avatar
      );

      if (stream) {
        this.localVideo.nativeElement.srcObject = stream;
        this.localVideo.nativeElement.muted = true;
        await this.localVideo.nativeElement.play();
      } else {
        this.isCameraOn = false;
        alert('Failed to access camera');
      }

    } else {
      this.isCameraOn = false;

      this.videoService.stopBroadcast(channel.channelId, user.username, channel.groupId);

      if (this.localVideo && this.localVideo.nativeElement) {
        this.localVideo.nativeElement.srcObject = null;
      }
    }
  }

  async toggleScreenShare() {
    const channel = this.currentChannel();
    const user = this.currentUser;

    if (!channel || !user) {
      console.error("No active channel or user found");
      return;
    }

    if (!this.isScreenSharing) {
      // Check if disabled
      if (this.isScreenshareDisabled) {
        const remote = Array.from(this.remoteScreenShares.values())[0];
        this.screenshareBlockedMessage.set(`${remote?.username || 'Someone'} is currently screensharing`);
        setTimeout(() => this.screenshareBlockedMessage.set(null), 3000);
        return;
      }
      
      if (!this.videoService.isPeerReady()) {
        alert('Video connection not ready yet. Please wait a moment and try again.');
        return;
      }

      const stream = await this.videoService.startScreenShare(
        channel.channelId,
        user.username,
        channel.groupId
      );

      if (stream) {
        this.currentScreenStream = stream;
        this.isScreenSharing = true;
        this.someoneElseScreensharing.set(false);
        
        // Use setTimeout to ensure the view has updated
        setTimeout(() => {
          if (this.localScreenShare && this.localScreenShare.nativeElement) {
            this.localScreenShare.nativeElement.srcObject = stream;
            this.localScreenShare.nativeElement.play().catch(err => {
              console.error('Error playing screenshare:', err);
            });
          }
        }, 0);
      } else {
        this.isScreenSharing = false;
      }

    } else {
      this.isScreenSharing = false;

      this.videoService.stopScreenShare(channel.channelId, user.username, channel.groupId);

      if (this.currentScreenStream) {
        this.currentScreenStream.getTracks().forEach(track => track.stop());
        this.currentScreenStream = null;
      }

      if (this.localScreenShare && this.localScreenShare.nativeElement) {
        this.localScreenShare.nativeElement.srcObject = null;
      }
    }
  }
}