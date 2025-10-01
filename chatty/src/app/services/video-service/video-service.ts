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

  constructor() {
    this.peer = new Peer({ host: 'localhost', port: 3000, path: '/peerjs' });

    this.peer.on('open', (id) => {
      console.log('✅ PeerJS connected with ID:', id);

      // listen for broadcast join requests
      this.sockets.on<any>('video:broadcast', ({ peerId, username }) => {
        if (peerId !== this.peer.id) {
          const call = this.peer.call(peerId, this.currentStream!);
          call.on('stream', (remoteStream) => {
            if (this.remoteHandler) this.remoteHandler(remoteStream);
          });
          this.connections.push(call);
        }
      });
    });

    this.peer.on('call', (call) => {
      call.answer(); // viewer doesn’t need to send media back
      call.on('stream', (remoteStream) => {
        if (this.remoteHandler) this.remoteHandler(remoteStream);
      });
      this.connections.push(call);
    });
  }

  startBroadcast(stream: MediaStream, groupId: string, channelId: string, username: string) {
    this.currentStream = stream;
    // notify channel members
    this.sockets.emit('video:broadcast', {
      groupId, channelId, username, peerId: this.peer.id
    });
  }

  stopBroadcast() {
    this.currentStream?.getTracks().forEach(t => t.stop());
    this.currentStream = null;
    this.connections.forEach(c => c.close());
    this.connections = [];
  }

  onRemoteStream(handler: (s: MediaStream) => void) {
    this.remoteHandler = handler;
  }
}
