import { Injectable } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Sockets } from '../sockets/sockets';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private peer!: Peer;
  private peerId: string | null = null;
  private connections: MediaConnection[] = [];
  private currentStream: MediaStream | null = null;
  private remoteHandler?: (peerId: string, stream: MediaStream) => void;
  private removeStreamHandler?: (peerId: string) => void;

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
      this.peerId = id;
      console.log('✅ PeerJS connected with ID:', id);
    });

  // Handle incoming calls
  this.peer.on('call', (call) => {
    console.log('📞 Incoming call from', call.peer);
    console.log('Current stream available?', !!this.currentStream);

    if (this.currentStream) {
      console.log('Stream tracks:', this.currentStream.getTracks());
      call.answer(this.currentStream);
      console.log('✅ Answered call with current stream');
    } else {
      console.warn('⚠️ No local stream available, answering with empty stream');
      call.answer(new MediaStream());
    }

    let streamReceived = false; // Prevent duplicate handling

    call.on('stream', (remoteStream) => {
      if (streamReceived) return; // Ignore duplicate stream events
      streamReceived = true;

      console.log(`🎥 Received remote stream from ${call.peer}`);
      console.log('Remote stream tracks:', remoteStream.getTracks());
      
      if (this.remoteHandler) {
        this.remoteHandler(call.peer, remoteStream);
      }
    });

    call.on('close', () => {
      console.log(`📴 Call closed with ${call.peer}`);
      if (this.removeStreamHandler) {
        this.removeStreamHandler(call.peer);
      }
    });

    call.on('error', (err) => {
      console.error('❌ Call error:', err);
    });

    this.connections.push(call);
  });

  // When other peers broadcast
  this.sockets.on<any>('video:broadcast', ({ peerId, username, channelId, groupId }) => {
    if (!this.peer || !this.peerId) {
      console.warn('⚠️ Peer not ready yet');
      return;
    }
    if (peerId === this.peerId) return; // ignore self

    console.log(`📡 Incoming broadcast from ${username} (${peerId})`);

    // Create a canvas-based dummy video track
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const canvasStream = canvas.captureStream();
    
    // Create a silent audio track
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const dst = audioContext.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    
    // Combine video and audio
    const dummyStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dst.stream.getAudioTracks()
    ]);

    console.log(`📞 Calling peer ${peerId} with dummy stream...`);
    const call = this.peer.call(peerId, dummyStream);

    if (!call) {
      console.error("❌ Failed to create PeerJS call to", peerId);
      // Clean up if call fails
      dummyStream.getTracks().forEach(track => track.stop());
      oscillator.stop();
      audioContext.close().catch(() => {}); // Ignore if already closed
      return;
    }

    let streamReceived = false; // Prevent duplicate handling

    call.on('stream', (remoteStream) => {
      if (streamReceived) return; // Ignore duplicate stream events
      streamReceived = true;

      console.log(`🎥 Received remote stream from ${username} (${peerId})`);
      console.log('Stream tracks:', remoteStream.getTracks());
      
      if (this.remoteHandler) {
        this.remoteHandler(peerId, remoteStream);
      }
      
      // Clean up dummy stream
      dummyStream.getTracks().forEach(track => track.stop());
      oscillator.stop();
      audioContext.close().catch(() => {}); // Ignore error if already closed
    });

    call.on('close', () => {
      console.log(`📴 Stream ended from ${peerId}`);
      if (this.removeStreamHandler) {
        this.removeStreamHandler(peerId);
      }
    });

    call.on('error', (err) => {
      console.error('❌ Peer call error:', err);
      // Clean up on error
      dummyStream.getTracks().forEach(track => track.stop());
      oscillator.stop();
      audioContext.close().catch(() => {});
    });

    this.connections.push(call);
  });

    // When someone stops broadcasting
    this.sockets.on<any>('video:stop', ({ peerId, username }) => {
      console.log(`🛑 ${username} stopped broadcasting (${peerId})`);
      if (this.removeStreamHandler) {
        this.removeStreamHandler(peerId);
      }
      
      // Close connection to that peer
      this.connections = this.connections.filter(conn => {
        if (conn.peer === peerId) {
          conn.close();
          return false;
        }
        return true;
      });
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

  onRemoveStream(handler: (peerId: string) => void) {
    this.removeStreamHandler = handler;
  }

  cleanup() {
    this.connections.forEach((c) => c.close());
    this.connections = [];
    this.currentStream?.getTracks().forEach((t) => t.stop());
    this.currentStream = null;
    if (this.peer) {
      this.peer.destroy();
    }
    console.log('🧹 Video service cleaned up');
  }

  async startBroadcast(channelId: string, username: string, groupId: string): Promise<MediaStream | null> {
    if (!this.peer || !this.peerId) {
      console.error("❌ Cannot broadcast – peer not ready");
      return null;
    }

    try {
      // Get media stream
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log(`📢 Broadcasting ${username} (${this.peerId}) to channel ${groupId}:${channelId}`);
      
      this.sockets.emit('video:broadcast', {
        peerId: this.peerId,
        username,
        channelId,
        groupId,
      });

      return this.currentStream;
    } catch (err) {
      console.error('❌ Failed to start broadcast:', err);
      return null;
    }
  }

  stopBroadcast(channelId: string, username: string, groupId: string) {
    if (!this.peer || !this.peerId || !this.currentStream) {
      console.warn("⚠️ Cannot stop – no active broadcast");
      return;
    }

    console.log(`🛑 Stopping broadcast for ${username} in channel ${channelId}`);
    
    this.sockets.emit('video:stop', {
      peerId: this.peerId,
      username,
      channelId,
      groupId
    });

    this.currentStream.getTracks().forEach(track => track.stop());
    this.currentStream = null;
  }

  isPeerReady(): boolean {
    return this.peerId !== null;
  }
}