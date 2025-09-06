import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';


@Injectable({
  providedIn: 'root'
})
export class Sockets {
  private socket: Socket;
  messages = signal<string[]>([]);
  private apiserver = 'http://localhost:3000';

  constructor() {
    this.socket = io(this.apiserver);
  }

  emit(event: string, payload?: any) {
    this.socket.emit(event, payload);
  }

  on<T>(event: string, callback: (data: T) => void) {
    this.socket.on(event, callback);
  }

  listenForGroups(callback: (groups: any[]) => void) {
    this.socket.on('groups:update', (groups) => {
      callback(groups);
    });
  }

  sendMessage(msg: string) {
    this.socket.emit('newmsg', msg);
  }

  onMessage():Observable<string> {
    return new Observable((observer) => {
      this.socket.on('newmsg', (msg: string) => {
        observer.next(msg);
      })
    })
  }

}
