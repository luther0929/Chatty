import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Sockets } from '../../services/sockets/sockets';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit {
  private socketService = inject(Sockets);
  protected readonly title = signal('chatty');
  messageout = signal('');
  messagein = signal<string[]>([]);

  ngOnInit() {
    this.socketService.onMessage().subscribe(
      (msg: string) => {
        this.messagein.update((msgs) => [...msgs, msg])
      }
    );
  }

  send() {
    this.socketService.sendMessage(this.messageout())
    this.messageout.set('');
  }
}
