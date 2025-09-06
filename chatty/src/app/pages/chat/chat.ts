import { Component, inject, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { GroupService } from '../../services/group-service/group-service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupService = inject(GroupService);

  groupId: string | null = null;

  // ✅ Computed so it always reflects latest groups
  group = computed(() => {
    if (!this.groupId) return null;
    return this.groupService.groups().find(g => g.id === this.groupId) || null;
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.groupId = params.get('groupId');
    });
  }

  goBack() {
    this.router.navigate(['/current-groups']);
  }
}
