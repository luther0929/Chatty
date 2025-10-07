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
  private remoteHandler?: (peerId: string, stream: MediaStream, username: string, avatar?: string) => void;
  private removeStreamHandler?: (peerId: string) => void;
  private activePeers = new Set<string>();
  private peerUsernames = new Map<string, string>();
  private peerAvatars = new Map<string, string | undefined>();

  private currentScreenStream: MediaStream | null = null;
  private remoteScreenHandler?: (peerId: string, stream: MediaStream, username: string) => void;
  private removeScreenHandler?: (peerId: string) => void;
  private activeScreenPeers = new Set<string>();
  private screenConnections: Map<string, MediaConnection> = new Map();
  private screenshareBlockedHandler?: (username: string) => void;

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
      console.log('PeerJS connected with ID:', id);
    });

    this.peer.on('call', (call) => {
      console.log('Incoming call from', call.peer, 'metadata:', call.metadata);
      
      const isScreenShare = call.metadata?.type === 'screenshare' || call.metadata?.type === 'screenshare-request';
      
      if (isScreenShare) {
        this.handleScreenShareCall(call);
        return;
      }
      
      const existingConnection = this.connections.get(call.peer);
      
      if (existingConnection && existingConnection.open) {
        console.log('Already have open connection with', call.peer, '- answering new call without closing existing');
        
        if (this.currentStream) {
          call.answer(this.currentStream);
          console.log('Answered new call with current stream (keeping existing connection)');
        } else {
          call.answer(new MediaStream());
        }
        
        return;
      }
      
      this.activePeers.add(call.peer);
      
      console.log('Current stream available?', !!this.currentStream);

      if (this.currentStream) {
        console.log('Stream tracks:', this.currentStream.getTracks());
        call.answer(this.currentStream);
        console.log('Answered call with current stream');
      } else {
        console.warn('No local stream available, answering with empty stream');
        call.answer(new MediaStream());
      }

      let streamReceived = false;

      call.on('stream', (remoteStream) => {
        if (streamReceived) return;
        streamReceived = true;

        console.log(`Received remote stream from ${call.peer}`);
        console.log('Remote stream tracks:', remoteStream.getTracks());
        
        if (this.remoteHandler) {
          const username = this.peerUsernames.get(call.peer) || 'Unknown';
          const avatar = this.peerAvatars.get(call.peer);
          this.remoteHandler(call.peer, remoteStream, username, avatar);
        }
      });

      call.on('close', () => {
        console.log(`Call closed with ${call.peer}`);
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
        console.error('Call error:', err);
        this.activePeers.delete(call.peer);
        this.connections.delete(call.peer);
      });

      this.connections.set(call.peer, call);
    });

    this.sockets.on<any>('video:broadcast', ({ peerId, username, channelId, groupId, avatar }) => {
      if (!this.peer || !this.peerId) {
        console.warn('Peer not ready yet');
        return;
      }
      if (peerId === this.peerId) return;

      this.peerUsernames.set(peerId, username);
      this.peerAvatars.set(peerId, avatar);

      if (this.activePeers.has(peerId)) {
        console.log(`Already connected to ${peerId} - calling them again to get their new stream`);
        
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

        console.log(`Re-calling peer ${peerId} to get their broadcast stream...`);
        const newCall = this.peer.call(peerId, dummyStream);

        if (!newCall) {
          console.error("Failed to create call to", peerId);
          dummyStream.getTracks().forEach(track => track.stop());
          oscillator.stop();
          audioContext.close().catch(() => {});
          return;
        }

        let streamReceived = false;

        newCall.on('stream', (remoteStream) => {
          if (streamReceived) return;
          streamReceived = true;

          console.log(`Received NEW broadcast stream from ${username} (${peerId})`);
          console.log('Stream tracks:', remoteStream.getTracks());
          
          this.connections.set(peerId, newCall);
          
          if (this.remoteHandler) {
            this.remoteHandler(peerId, remoteStream, username, avatar);
          }
          
          dummyStream.getTracks().forEach(track => track.stop());
          oscillator.stop();
          audioContext.close().catch(() => {});
        });

        newCall.on('close', () => {
          console.log(`Re-call closed with ${peerId}`);
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
          console.error('Re-call error:', err);
          dummyStream.getTracks().forEach(track => track.stop());
          oscillator.stop();
          audioContext.close().catch(() => {});
        });

        return;
      }

      this.activePeers.add(peerId);

      console.log(`Incoming broadcast from ${username} (${peerId})`);

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

      console.log(`Calling peer ${peerId} with dummy stream...`);
      const call = this.peer.call(peerId, dummyStream);

      if (!call) {
        console.error("Failed to create PeerJS call to", peerId);
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

        console.log(`Received remote stream from ${username} (${peerId})`);
        console.log('Stream tracks:', remoteStream.getTracks());
        
        if (this.remoteHandler) {
          this.remoteHandler(peerId, remoteStream, username, avatar);
        }
        
        dummyStream.getTracks().forEach(track => track.stop());
        oscillator.stop();
        audioContext.close().catch(() => {});
      });

      call.on('close', () => {
        console.log(`Stream ended from ${peerId}`);
        this.activePeers.delete(peerId);
        this.connections.delete(peerId);
        if (this.removeStreamHandler) {
          this.removeStreamHandler(peerId);
        }
      });

      call.on('error', (err) => {
        console.error('Peer call error:', err);
        this.activePeers.delete(peerId);
        this.connections.delete(peerId);
        dummyStream.getTracks().forEach(track => track.stop());
        oscillator.stop();
        audioContext.close().catch(() => {});
      });

      this.connections.set(peerId, call);
    });

    // Screenshare broadcast listener
    this.sockets.on<any>('screenshare:broadcast', ({ peerId, username, channelId, groupId }) => {
      if (!this.peer || !this.peerId || peerId === this.peerId) return;

      console.log(`📺 Incoming screenshare broadcast from ${username} (${peerId})`);

      this.peerUsernames.set(peerId, username);
      this.activeScreenPeers.add(peerId);

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

      console.log(`Calling ${peerId} to receive screenshare...`);
      const call = this.peer.call(peerId, dummyStream, { metadata: { type: 'screenshare-request' } });

      if (!call) {
        console.error('Failed to create screenshare call');
        this.activeScreenPeers.delete(peerId);
        dummyStream.getTracks().forEach(track => track.stop());
        oscillator.stop();
        audioContext.close().catch(() => {});
        return;
      }

      let streamReceived = false;

      call.on('stream', (remoteStream) => {
        if (streamReceived) return;
        streamReceived = true;
        
        console.log(`📺 Received screenshare stream from ${username} (${peerId})`);
        console.log('Screenshare stream tracks:', remoteStream.getTracks());
        
        if (this.remoteScreenHandler) {
          this.remoteScreenHandler(peerId, remoteStream, username);
        }
        
        dummyStream.getTracks().forEach(track => track.stop());
        oscillator.stop();
        audioContext.close().catch(() => {});
      });

      call.on('close', () => {
        console.log(`📺 Screenshare call closed with ${peerId}`);
        this.activeScreenPeers.delete(peerId);
        this.screenConnections.delete(peerId);
        if (this.removeScreenHandler) {
          this.removeScreenHandler(peerId);
        }
      });

      call.on('error', (err) => {
        console.error('Screenshare call error:', err);
        this.activeScreenPeers.delete(peerId);
        this.screenConnections.delete(peerId);
        dummyStream.getTracks().forEach(track => track.stop());
        oscillator.stop();
        audioContext.close().catch(() => {});
      });

      this.screenConnections.set(peerId, call);
    });

    this.sockets.on<any>('screenshare:stop', ({ peerId, username }) => {
      const conn = this.screenConnections.get(peerId);
      if (conn) conn.close();
      
      this.activeScreenPeers.delete(peerId);
      this.screenConnections.delete(peerId);
      
      if (this.removeScreenHandler) {
        this.removeScreenHandler(peerId);
      }
    });

    this.sockets.on<any>('screenshare:blocked', ({ username }) => {
      console.log(`Screenshare blocked - ${username} is already sharing`);
      if (this.screenshareBlockedHandler) {
        this.screenshareBlockedHandler(username);
      }
    });

    this.sockets.on<any>('video:stop', ({ peerId, username }) => {
      console.log(`${username} stopped broadcasting (${peerId})`);
      
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.close();
      }
      
      this.activePeers.delete(peerId);
      this.connections.delete(peerId);
      this.peerUsernames.delete(peerId);
      this.peerAvatars.delete(peerId);
      
      if (this.removeStreamHandler) {
        this.removeStreamHandler(peerId);
      }
    });
  }

  private handleVideoCall(call: MediaConnection) {
    const existingConnection = this.connections.get(call.peer);
    
    if (existingConnection && existingConnection.open) {
      console.log('Already have open connection with', call.peer);
      
      if (this.currentStream) {
        call.answer(this.currentStream);
      } else {
        call.answer(new MediaStream());
      }
      return;
    }
    
    this.activePeers.add(call.peer);

    if (this.currentStream) {
      call.answer(this.currentStream);
    } else {
      call.answer(new MediaStream());
    }

    let streamReceived = false;

    call.on('stream', (remoteStream) => {
      if (streamReceived) return;
      streamReceived = true;

      if (this.remoteHandler) {
        const username = this.peerUsernames.get(call.peer) || 'Unknown';
        const avatar = this.peerAvatars.get(call.peer);
        this.remoteHandler(call.peer, remoteStream, username, avatar);
      }
    });

    call.on('close', () => {
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
      console.error('Call error:', err);
      this.activePeers.delete(call.peer);
      this.connections.delete(call.peer);
    });

    this.connections.set(call.peer, call);
  }

 private handleScreenShareCall(call: MediaConnection) {
  console.log('📺 Incoming screenshare call from', call.peer);
  
  // Answer immediately with current stream
  if (this.currentScreenStream) {
    console.log('📺 Answering with current screenshare stream');
    console.log('📺 Stream tracks:', this.currentScreenStream.getTracks());
    call.answer(this.currentScreenStream);
  } else {
    console.log('📺 No screenshare stream yet, answering with empty stream');
    call.answer(new MediaStream());
  }

  // Don't expect a stream back - this is them requesting our stream, not sharing theirs
  call.on('close', () => {
    console.log('📺 Screenshare request call closed');
  });

  call.on('error', (err) => {
    console.error('Screenshare request call error:', err);
  });
}

  async enableCamera(localVideo: HTMLVideoElement) {
    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = this.currentStream;
      console.log('Camera enabled');
    } catch (err) {
      console.error('Could not access camera', err);
    }
  }

  disableCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
      console.log('Camera disabled');
    }
  }

  onRemoteStream(handler: (peerId: string, stream: MediaStream, username: string, avatar?: string) => void) {
    this.remoteHandler = handler;
  }

  onRemoveStream(handler: (peerId: string) => void) {
    this.removeStreamHandler = handler;
  }

  cleanup() {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.screenConnections.forEach((conn) => conn.close());
    this.screenConnections.clear();
    this.activePeers.clear();
    this.activeScreenPeers.clear();
    this.currentStream = null;
    this.currentScreenStream?.getTracks().forEach((t) => t.stop());
    this.currentScreenStream = null;
    if (this.peer) {
      this.peer.destroy();
    }
    console.log('Video service cleaned up');
  }

  async startBroadcast(channelId: string, username: string, groupId: string, avatar?: string): Promise<MediaStream | null> {
    if (!this.peer || !this.peerId) {
      console.error("Cannot broadcast – peer not ready");
      return null;
    }

    try {
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log(`Broadcasting ${username} (${this.peerId}) to channel ${groupId}:${channelId}`);
      
      this.sockets.emit('video:broadcast', {
        peerId: this.peerId,
        username,
        channelId,
        groupId,
        avatar
      });

      return this.currentStream;
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      return null;
    }
  }

  stopBroadcast(channelId: string, username: string, groupId: string) {
    if (!this.peer || !this.peerId || !this.currentStream) {
      console.warn("Cannot stop – no active broadcast");
      return;
    }

    console.log(`Stopping broadcast for ${username} in channel ${channelId}`);
    
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

  onRemoteScreenShare(handler: (peerId: string, stream: MediaStream, username: string) => void) {
    this.remoteScreenHandler = handler;
  }

  onRemoveScreenShare(handler: (peerId: string) => void) {
    this.removeScreenHandler = handler;
  }

  onScreenshareBlocked(handler: (username: string) => void) {
    this.screenshareBlockedHandler = handler;
  }

  async startScreenShare(channelId: string, username: string, groupId: string): Promise<MediaStream | null> {
    if (!this.peer || !this.peerId) {
      console.error("Cannot screenshare – peer not ready");
      return null;
    }

    try {
      this.currentScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      console.log('📺 Screenshare stream obtained, tracks:', this.currentScreenStream.getTracks());

      this.currentScreenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare(channelId, username, groupId);
      };

      // Small delay to ensure stream is ready before others call
      await new Promise(resolve => setTimeout(resolve, 100));

      this.sockets.emit('screenshare:broadcast', {
        peerId: this.peerId,
        username,
        channelId,
        groupId
      });

      console.log('📺 Broadcast emitted');

      return this.currentScreenStream;
    } catch (err) {
      console.error('Failed to start screenshare:', err);
      return null;
    }
  }

  stopScreenShare(channelId: string, username: string, groupId: string) {
    if (!this.peer || !this.peerId || !this.currentScreenStream) return;
    
    this.sockets.emit('screenshare:stop', {
      peerId: this.peerId,
      username,
      channelId,
      groupId
    });

    this.currentScreenStream.getTracks().forEach(track => track.stop());
    this.currentScreenStream = null;
  }
}