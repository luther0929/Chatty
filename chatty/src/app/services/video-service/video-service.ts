import { Injectable } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Sockets } from '../sockets/sockets';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private peer!: Peer;
  private connections: MediaConnection[] = [];
  private currentStream: MediaStream | null = null;
  private remoteHandler?: (peerId: string, stream: MediaStream) => void;

  constructor(private sockets: Sockets) {
    this.initPeer();
  }

  private initPeer() {
    this.peer = new Peer({
      host: 'localhost',
      port: 3000,
      path: '/peerjs',
    });

    this.peer.on('open', (id) => {
      console.log('✅ PeerJS connected with ID:', id);
      this.sockets.emit('video:ready', { peerId: id });
    });

    // Handle incoming calls
    this.peer.on('call', (call) => {
      console.log('📞 Incoming call from', call.peer);

      if (this.currentStream) {
        call.answer(this.currentStream);
      } else {
        console.warn('⚠️ No local stream available, ignoring call');
        // Don’t answer with nothing — just return
        return;
      }

      call.on('stream', (remoteStream) => {
        console.log(`🎥 Received remote stream from ${call.peer}`);
        if (this.remoteHandler) {
          this.remoteHandler(call.peer, remoteStream); // ✅ pass the actual peerId
        }
      });

      this.connections.push(call);
    });

    // When other peers broadcast
    this.sockets.on<any>('video:broadcast', ({ peerId, username, channelId, groupId }) => {
      if (!this.peer) return;
      if (peerId === this.peer.id) return; // ignore self

      console.log(`📡 Incoming broadcast from ${username} (${peerId}) in ${groupId}:${channelId}`);

      // Create a dummy stream since PeerJS type requires one
      const dummyStream = new MediaStream();
      const call = this.peer.call(peerId, dummyStream);

      if (!call) {
        console.error("❌ Failed to create PeerJS call to", peerId);
        return;
      }

      call.on('stream', (remoteStream) => {
        console.log(`🎥 Received remote stream from ${username} (${peerId})`);
        if (this.remoteHandler) {
          this.remoteHandler(peerId, remoteStream);
        }
      });

      call.on('error', (err) => console.error('Peer call error:', err));
    });
  }

  async enableCamera(localVideo: HTMLVideoElement) {
    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = this.currentStream;
      console.log('📷 Camera enabled');
    } catch (err) {
      console.error('❌ Could not access camera', err);
    }
  }

  disableCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
      console.log('📷 Camera disabled');
    }
  }

  onRemoteStream(handler: (peerId: string, stream: MediaStream) => void) {
    this.remoteHandler = handler;
  }

  cleanup() {
    this.connections.forEach((c) => c.close());
    this.connections = [];
    this.currentStream?.getTracks().forEach((t) => t.stop());
    this.currentStream = null;
    this.peer.destroy();
    console.log('🧹 Video service cleaned up');
  }

  startBroadcast(stream: MediaStream, channelId: string, username: string, groupId: string) {
    if (!this.peer) {
      console.warn("⚠️ Cannot broadcast — missing peer");
      return;
    }

    this.currentStream = stream;

    console.log(`📢 Broadcasting ${username} (${this.peer.id}) to channel ${channelId}`);
    this.sockets.emit('video:broadcast', {
      peerId: this.peer.id,
      username,
      channelId,
      groupId,   // ✅ include groupId
    });
  }

  stopBroadcast(channelId: string, username: string) {
    if (!this.peer || !this.currentStream) {
      console.warn("⚠️ Cannot stop — no active broadcast");
      return;
    }

    console.log(`🛑 Stopping broadcast for ${username} in channel ${channelId}`);
    this.sockets.emit('video:stop', {
      peerId: this.peer.id,
      username,
      channelId,
    });

    this.currentStream.getTracks().forEach(track => track.stop());
    this.currentStream = null;
  }

}
