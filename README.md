# Project Documentation

## Data Structures

### Client-Side (Angular Models)

ts
// user.ts
export interface User {
  id: string;
  username: string;   // unique key
  email: string;
  password: string;
  roles: string[];    // 'chatUser' | 'groupAdmin' | 'superAdmin'
  groups: string[];   // group ids the user belongs to
}

// channel.ts
export interface Message { username: string; text: string; timestamp: Date; }

export interface Channel {
  id: string;
  name: string;
  users: string[];       // usernames currently in the channel
  messages: Message[];   // persisted messages
}

// group.ts
export interface Group {
  id: string;
  name: string;
  createdBy?: string;
  admins: string[];          // usernames
  members: string[];         // usernames
  bannedMembers?: string[];  // usernames
  channels: Channel[];
  joinRequests: string[];    // pending usernames
}

// report.ts
export interface Report {
  id: string;
  groupId: string;
  member: string;       // reported username
  reportedBy: string;   // admin username
  text: string;
  timestamp: number;
}

##Angular Architecture
###Components (Pages)

login – sign in / sign up.

current-groups – lists groups, join/leave, dashboard link.

chat – Discord-style layout: channels (left), messages (center), channel members (right).

group-admin-dashboard – manage groups, members, join requests, bans, reports.

super-dashboard – global view for super admins (all groups, reports, promotions).

Services

GroupService – central state manager, handles Socket.IO events, updates signals.

UserService – handles authentication, session persistence, CRUD for users.

Sockets – low-level Socket.IO wrapper.

Guards

auth-guard – enforces role-based route access.

Models

user.ts, group.ts, channel.ts, report.ts.

Routes

/login

/current-groups

/chat/:groupId

/group-admin-dashboard

/super-dashboard

###Node.js Server Architecture
Modules

express, http, socket.io, cors

Global State

Arrays: users, groups, reports

Pattern

Each incoming Socket.IO event mutates state.

Server broadcasts updates (groups:update, channels:*, reports:update).

Clients stay synchronized in real-time.

###Socket.IO API
###Groups

groups:getAll → returns all groups.

groups:create → create group (broadcast).

groups:delete → delete (admin/super only).

groups:requestJoin → add to join requests.

groups:approveJoin / groups:declineJoin → admin action.

groups:removeMember → remove user from group/channels.

groups:ban → move user to banned list.

groups:leave → member self-removal.

###Channels

channels:create / channels:delete → admin/super only.

channels:join / channels:leave → manage membership.

channels:message → append & broadcast message.

channels:getMessages → load persisted messages.

###Users & Roles

users:promote → assign roles.

users:delete → global deletion, cleanup.

###Reports

reports:create → admin reports member → visible to super admins.

###Client ↔ Server Flow

Startup: groups:getAll → server emits groups:update → Angular signals refreshed.

Join channel: client emits channels:join → server updates membership + system message → broadcasts.

Send message: client emits channels:message → server appends & broadcasts → UI re-renders.

Admin actions: (approve, ban, remove) → server mutates → broadcasts to all clients.

###Authentication & Authorization

Login/Register: UserService manages user list (initial seed includes super/123).

Session: Successful login saved in sessionStorage.

Logout: clears session + redirects /login.

Guarded UI: auth-guard checks roles; templates hide/show actions based on roles.

Role updates: server emits users:roleUpdate → merged into client state.

###Role Abilities

Super Admin

All group admin powers

Promote/demote users

Remove any user

View all reports

Group Admin

Manage groups they own

Create/delete channels

Approve/decline join requests

Ban/remove members

Report users

Chat User

Register/login

Join/leave groups

Chat in channels

Delete own account

###REST Mapping (Future Plan)
Event	REST Endpoint	Purpose
groups:getAll	GET /api/groups	Fetch groups
groups:create	POST /api/groups	Create group
groups:delete	DELETE /api/groups/:id	Delete group
groups:requestJoin	POST /api/groups/:id/requests	Request to join
groups:approveJoin	POST /api/groups/:id/requests/:username/approve	Approve join request
channels:create	POST /api/groups/:id/channels	Create channel
channels:message	POST /api/groups/:gid/channels/:cid/messages	Send message
