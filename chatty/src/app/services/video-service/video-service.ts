import { Injectable } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';
import { Sockets } from '../sockets/sockets';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private peer: Peer;
  private sockets = new Sockets();
  private currentStream: MediaStream | null = null;
  private connections: MediaConnection[] = [];
  private remoteHandler: ((s: MediaStream) => void) | null = null;
  private createEmptyStream(): MediaStream {
    return new MediaStream(); // no tracks
  }
  private remoteStreams: Map<string, MediaStream> = new Map();

  constructor() {
    this.peer = new Peer({
      host: 'localhost',
      port: 3000,
      path: '/peerjs'
    });

    // PeerJS open event
    this.peer.on('open', (id) => {
      console.log('✅ PeerJS connected with ID:', id);

      // Listen for broadcast announcements from others
      this.sockets.on<any>('video:broadcast', ({ peerId, username }) => {
        if (peerId !== this.peer.id) {
          console.log(`📡 Connecting to ${username} (${peerId})`);

          const streamToSend = this.currentStream ? this.currentStream : this.createEmptyStream();
          const call = this.peer.call(peerId, streamToSend);

          call.on('stream', (remoteStream) => {
            console.log('🎥 Received stream from', username);
            if (this.remoteHandler) this.remoteHandler(remoteStream);
          });

          this.connections.push(call);
        }
      });

    });

    // When someone calls us
    this.peer.on('call', (call) => {
      const streamToSend = this.currentStream ? this.currentStream : new MediaStream();
      call.answer(streamToSend);
      call.on('stream', (remoteStream) => {
        console.log('🎥 Got remote stream');
        if (this.remoteHandler) this.remoteHandler(remoteStream);
      });
      this.connections.push(call);
    });
  }

  /** Start broadcasting my stream */
  async startBroadcast(localStream: MediaStream, groupId: string, channelId: string, username: string) {
    this.currentStream = localStream;
    this.sockets.emit('video:broadcast', {
      groupId,
      channelId,
      username,
      peerId: this.peer.id
    });
  }

  /** Stop broadcasting & close connections */
  stopBroadcast() {
    this.currentStream?.getTracks().forEach(t => t.stop());
    this.currentStream = null;
    this.connections.forEach(c => c.close());
    this.connections = [];
  }

  /** Subscribe component to new remote streams */
  onRemoteStream(handler: (id: string, stream: MediaStream) => void) {
    this.peer.on('call', (call) => {
      const streamToSend = this.currentStream ? this.currentStream : new MediaStream();
      call.answer(streamToSend);

      call.on('stream', (remoteStream) => {
        this.remoteStreams.set(call.peer, remoteStream);
        handler(call.peer, remoteStream);
      });

      call.on('close', () => {
        this.remoteStreams.delete(call.peer);
      });
    });
  }
}
