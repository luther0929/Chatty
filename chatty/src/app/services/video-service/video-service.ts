import { Injectable } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';

@Injectable({ providedIn: 'root' })
export class VideoService {
  private peer: Peer;
  private currentCall: MediaConnection | null = null;

  constructor() {
    this.peer = new Peer({
      host: 'localhost',
      port: 3000,
      path: '/peerjs'
    });

    this.peer.on('open', (id) => {
      console.log('✅ PeerJS connected with ID:', id);
    });
  }

  async startCall(remotePeerId: string, localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    localVideo.muted = true;
    await localVideo.play();

    const call = this.peer.call(remotePeerId, stream);

    call.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.play();
    });

    this.currentCall = call;
  }

  answerCall(localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement) {
    this.peer.on('call', async (call) => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = stream;
      localVideo.muted = true;
      await localVideo.play();

      call.answer(stream);

      call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play();
      });

      this.currentCall = call;
    });
  }

  endCall() {
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
  }
}
