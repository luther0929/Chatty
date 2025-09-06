import { Routes } from '@angular/router';
import { Chat } from './pages/chat/chat';
import { SuperDashboard } from './pages/super-dashboard/super-dashboard';
import { GroupAdminDashboard } from './pages/group-admin-dashboard/group-admin-dashboard';
import { Login } from './pages/login/login';
import { authGuard } from './guards/auth-guard';
import { CurrentGroups } from './pages/current-groups/current-groups';


export const routes: Routes = [
    { path: 'login', component: Login },
    { path: 'current-groups', component: CurrentGroups, canActivate: [authGuard], data: { roles: ['chatUser', 'groupAdmin', 'superAdmin'] } },
    { path: 'chat/:groupId', component: Chat, canActivate: [authGuard], data: { roles: ['chatUser', 'groupAdmin', 'superAdmin'] } },
    { path: 'super-dashboard', component: SuperDashboard, canActivate: [authGuard], data: { roles: ['superAdmin'] } },
    { path: 'group-admin-dashboard', component: GroupAdminDashboard, canActivate: [authGuard], data: { roles: ['groupAdmin'] } },
    { path: '', redirectTo: '/login', pathMatch: 'full' }
];
