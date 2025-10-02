import { Injectable } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Sockets } from '../sockets/sockets';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private peer!: Peer;
  private peerId: string | null = null;
  private connections: Map<string, MediaConnection> = new Map();
  private currentStream: MediaStream | null = null;
  private remoteHandler?: (peerId: string, stream: MediaStream) => void;
  private removeStreamHandler?: (peerId: string) => void;
  private activePeers = new Set<string>(); // Track which peers we're connected to

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
// Handle incoming calls
this.peer.on('call', (call) => {
  console.log('📞 Incoming call from', call.peer);
  
  // Check if we already have a connection with this peer
  const existingConnection = this.connections.get(call.peer);
  
  if (existingConnection && existingConnection.open) {
    console.log('⚠️ Already have open connection with', call.peer, '- answering new call without closing existing');
    // Don't close the existing connection - just answer this new one
    // The caller needs our stream, but we already have theirs
    
    if (this.currentStream) {
      call.answer(this.currentStream);
      console.log('✅ Answered new call with current stream (keeping existing connection)');
    } else {
      call.answer(new MediaStream());
    }
    
    // Don't store this connection or set up handlers
    // We keep the original connection for receiving their stream
    return;
  }
  
  // This is a new peer connection
  this.activePeers.add(call.peer);
  
  console.log('Current stream available?', !!this.currentStream);

  if (this.currentStream) {
    console.log('Stream tracks:', this.currentStream.getTracks());
    call.answer(this.currentStream);
    console.log('✅ Answered call with current stream');
  } else {
    console.warn('⚠️ No local stream available, answering with empty stream');
    call.answer(new MediaStream());
  }

  let streamReceived = false;

  call.on('stream', (remoteStream) => {
    if (streamReceived) return;
    streamReceived = true;

    console.log(`🎥 Received remote stream from ${call.peer}`);
    console.log('Remote stream tracks:', remoteStream.getTracks());
    
    if (this.remoteHandler) {
      this.remoteHandler(call.peer, remoteStream);
    }
  });

  call.on('close', () => {
    console.log(`📴 Call closed with ${call.peer}`);
    const currentConnection = this.connections.get(call.peer);
    if (!currentConnection || currentConnection === call) {
      this.activePeers.delete(call.peer);
      this.connections.delete(call.peer);
      if (this.removeStreamHandler) {
        this.removeStreamHandler(call.peer);
      }
    }
  });

  call.on('error', (err) => {
    console.error('❌ Call error:', err);
    this.activePeers.delete(call.peer);
    this.connections.delete(call.peer);
  });

  this.connections.set(call.peer, call);
});

// When other peers broadcast
this.sockets.on<any>('video:broadcast', ({ peerId, username, channelId, groupId }) => {
  if (!this.peer || !this.peerId) {
    console.warn('⚠️ Peer not ready yet');
    return;
  }
  if (peerId === this.peerId) return; // ignore self

  // Check if we're already connected to this peer
  // Check if we're already connected to this peer
if (this.activePeers.has(peerId)) {
  console.log(`⚠️ Already connected to ${peerId} - calling them again to get their new stream`);
  
  // They started broadcasting after we connected - call them again
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const canvasStream = canvas.captureStream();
  
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const dst = audioContext.createMediaStreamDestination();
  oscillator.connect(dst);
  oscillator.start();
  
  const dummyStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dst.stream.getAudioTracks()
  ]);

  console.log(`📞 Re-calling peer ${peerId} to get their broadcast stream...`);
  const newCall = this.peer.call(peerId, dummyStream);

  if (!newCall) {
    console.error("❌ Failed to create call to", peerId);
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
    return;
  }

  let streamReceived = false;

  newCall.on('stream', (remoteStream) => {
    if (streamReceived) return;
    streamReceived = true;

    console.log(`🎥 Received NEW broadcast stream from ${username} (${peerId})`);
    console.log('Stream tracks:', remoteStream.getTracks());
    
    // DON'T close the old connection - just replace it silently
    // The old connection will close naturally when PeerJS cleans up
    this.connections.set(peerId, newCall);
    
    // Update the stream handler - this will replace the old stream in the UI
    if (this.remoteHandler) {
      this.remoteHandler(peerId, remoteStream);
    }
    
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
  });

  newCall.on('close', () => {
    console.log(`📴 Re-call closed with ${peerId}`);
    const currentConnection = this.connections.get(peerId);
    if (currentConnection === newCall) {
      this.connections.delete(peerId);
      this.activePeers.delete(peerId);
      if (this.removeStreamHandler) {
        this.removeStreamHandler(peerId);
      }
    }
  });

  newCall.on('error', (err) => {
    console.error('❌ Re-call error:', err);
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
  });

  return;
}

  // Mark as active immediately before creating call
  this.activePeers.add(peerId);

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
    this.activePeers.delete(peerId);
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
    return;
  }

  let streamReceived = false;

  call.on('stream', (remoteStream) => {
    if (streamReceived) return;
    streamReceived = true;

    console.log(`🎥 Received remote stream from ${username} (${peerId})`);
    console.log('Stream tracks:', remoteStream.getTracks());
    
    if (this.remoteHandler) {
      this.remoteHandler(peerId, remoteStream);
    }
    
    // Clean up dummy stream
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
  });

  call.on('close', () => {
    console.log(`📴 Stream ended from ${peerId}`);
    this.activePeers.delete(peerId);
    this.connections.delete(peerId);
    if (this.removeStreamHandler) {
      this.removeStreamHandler(peerId);
    }
  });

  call.on('error', (err) => {
    console.error('❌ Peer call error:', err);
    this.activePeers.delete(peerId);
    this.connections.delete(peerId);
    dummyStream.getTracks().forEach(track => track.stop());
    oscillator.stop();
    audioContext.close().catch(() => {});
  });

  this.connections.set(peerId, call);
});

    // When someone stops broadcasting
    this.sockets.on<any>('video:stop', ({ peerId, username }) => {
      console.log(`🛑 ${username} stopped broadcasting (${peerId})`);
      
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.close();
      }
      
      this.activePeers.delete(peerId);
      this.connections.delete(peerId);
      
      if (this.removeStreamHandler) {
        this.removeStreamHandler(peerId);
      }
    });
  }

  // Keep all other methods the same...
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
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.activePeers.clear();
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