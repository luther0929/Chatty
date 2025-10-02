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

  groupId: string | null = null;
  selectedImage: File | null = null;
  selectedImagePreview: string | null = null;
  messageText = signal('');

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;

  isCameraOn = false;
  remoteStreams = new Map<string, MediaStream>();
  remoteStreamArray = signal<MediaStream[]>([]);

  private cdr = inject(ChangeDetectorRef);

  initialOf(name?: string): string {
    const n = (name ?? '').trim();
    return n ? n[0].toUpperCase() : '?';
  }

  gradientCSS = 'linear-gradient(90deg, #6237A0, #9754CB)';

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

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.groupId = params.get('groupId');
      this.groupService.initialize();
    });

    // Register username with socket
    const user = this.userService.getCurrentUser();
    if (user) {
      this.sockets.emit('user:register', { username: user.username });
    }

    // Handle incoming remote streams
    this.videoService.onRemoteStream((peerId, stream) => {
      console.log('📺 Adding remote stream from', peerId);
      this.remoteStreams.set(peerId, stream);
      // Update the signal to trigger change detection
      this.remoteStreamArray.set(Array.from(this.remoteStreams.values()));
      this.cdr.detectChanges(); // Force change detection
    });

    // Handle stream removal
    this.videoService.onRemoveStream((peerId) => {
      console.log('📺 Removing remote stream from', peerId);
      this.remoteStreams.delete(peerId);
      // Update the signal to trigger change detection
      this.remoteStreamArray.set(Array.from(this.remoteStreams.values()));
      this.cdr.detectChanges(); // Force change detection
    });
  }

  ngOnDestroy() {
    // Clean up camera if on
    if (this.isCameraOn) {
      const channel = this.currentChannel();
      const user = this.currentUser;
      if (channel && user) {
        this.videoService.stopBroadcast(channel.channelId, user.username, channel.groupId);
      }
    }
  }

  get currentUser() {
    return this.userService.getCurrentUser();
  }

  joinChannel(channelId: string, channelName: string) {
    const user = this.userService.getCurrentUser();
    if (this.groupId && user) {
      // Stop camera if currently on
      if (this.isCameraOn) {
        this.toggleCamera();
      }
      
      this.groupService.joinChannel(this.groupId, channelId, channelName, user.username);
      
      // Clear remote streams when changing channels
      this.remoteStreams.clear();
      this.remoteStreamArray.set([]);
    }
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
    return 'http://localhost:3000/uploads/avatars/avatar-placeholder.png';
  }

  async toggleCamera() {
    const channel = this.currentChannel();
    const user = this.currentUser;

    if (!channel || !user) {
      console.error("❌ No active channel or user found");
      return;
    }

    if (!this.isCameraOn) {
      // Check if peer is ready
      if (!this.videoService.isPeerReady()) {
        alert('Video connection not ready yet. Please wait a moment and try again.');
        return;
      }

      this.isCameraOn = true;

      // Start broadcast (this now handles getUserMedia internally)
      const stream = await this.videoService.startBroadcast(
        channel.channelId, 
        user.username, 
        channel.groupId
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

      // Stop broadcasting
      this.videoService.stopBroadcast(channel.channelId, user.username, channel.groupId);

      // Clear local video
      if (this.localVideo && this.localVideo.nativeElement) {
        this.localVideo.nativeElement.srcObject = null;
      }
    }
  }
}