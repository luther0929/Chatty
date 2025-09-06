# Real-Time Group Chat Application Documentation

This document provides a comprehensive overview of a real-time group chat application built with Angular (client-side), Node.js (server-side), and Socket.IO for real-time communication. It details the data structures, client and server architectures, Socket.IO API, workflows, authentication, authorization, and planned REST API mappings.

## Table of Contents

- [Data Structures](#data-structures)
- [Angular Architecture](#angular-architecture)
- [Node.js Server Architecture](#nodejs-server-architecture)
- [Socket.IO API](#socketio-api)
- [Client ↔ Server Flow](#client--server-flow)
- [Authentication & Authorization](#authentication--authorization)
- [Role Abilities](#role-abilities)
- [REST Mapping (Future Plan)](#rest-mapping-future-plan)

## Data Structures

### Client-Side (Angular Models)

#### `user.ts`

```typescript
export interface User {
  id: string;           // Unique identifier
  username: string;     // Unique key
  email: string;        // User email
  password: string;     // Hashed password
  roles: string[];      // Possible values: 'chatUser', 'groupAdmin', 'superAdmin'
  groups: string[];     // Array of group IDs the user belongs to
}
```

#### `channel.ts`

```typescript
export interface Message {
  username: string;     // Sender's username
  text: string;         // Message content
  timestamp: Date;      // Message timestamp
}

export interface Channel {
  id: string;           // Unique channel ID
  name: string;         // Channel name
  users: string[];      // Usernames currently in the channel
  messages: Message[];  // Persisted messages
}
```

#### `group.ts`

```typescript
export interface Group {
  id: string;           // Unique group ID
  name: string;         // Group name
  createdBy?: string;   // Username of creator (optional)
  admins: string[];     // Usernames of group admins
  members: string[];    // Usernames of group members
  bannedMembers?: string[];  // Usernames of banned members (optional)
  channels: Channel[];  // List of channels in the group
  joinRequests: string[];   // Pending usernames requesting to join
}
```

#### `report.ts`

```typescript
export interface Report {
  id: string;           // Unique report ID
  groupId: string;      // Associated group ID
  member: string;       // Reported username
  reportedBy: string;   // Admin username who reported
  text: string;         // Report description
  timestamp: number;    // Report timestamp
}
```

## Angular Architecture

### Components (Pages)

- **Login**: Handles user sign-in and sign-up functionality
- **Current Groups**: Displays available groups, allows joining/leaving, and provides links to group dashboards
- **Chat**: Discord-style layout with channels (left), messages (center), and channel members (right)
- **Group Admin Dashboard**: Manages group settings, members, join requests, bans, and reports
- **Super Dashboard**: Provides a global view for super admins, showing all groups, reports, and user promotion/demotion options

### Services

- **GroupService**: Central state manager, processes Socket.IO events, and updates Angular signals for real-time UI updates
- **UserService**: Manages authentication, session persistence, and CRUD operations for users
- **Sockets**: Low-level wrapper for Socket.IO communication

### Guards

- **AuthGuard**: Enforces role-based access control for routes, ensuring users can only access authorized pages

### Models

- `user.ts`
- `group.ts`
- `channel.ts`
- `report.ts`

### Routes

- `/login`: Login and registration page
- `/current-groups`: Displays groups with join/leave functionality
- `/chat/:groupId`: Chat interface for a specific group
- `/group-admin-dashboard`: Group management interface for group admins
- `/super-dashboard`: Global management interface for super admins

## Node.js Server Architecture

### Modules

- **express**: Web server framework for handling HTTP requests
- **http**: Core HTTP server module
- **socket.io**: Enables real-time, bidirectional communication
- **cors**: Supports cross-origin resource sharing

### Global State

- **Users**: Array storing all registered users
- **Groups**: Array storing all groups
- **Reports**: Array storing all reports

### Pattern

- Incoming Socket.IO events mutate the global state
- The server broadcasts updates to clients using events such as `groups:update`, `channels:*`, and `reports:update`
- Clients remain synchronized with the server in real-time

## Socket.IO API

### Groups

| Event | Description |
|-------|-------------|
| `groups:getAll` | Returns a list of all groups |
| `groups:create` | Creates a new group and broadcasts the update |
| `groups:delete` | Deletes a group (restricted to group admins or super admins) |
| `groups:requestJoin` | Adds a user to a group's join requests |
| `groups:approveJoin` | Approves a join request (admin only) |
| `groups:declineJoin` | Declines a join request (admin only) |
| `groups:removeMember` | Removes a user from a group and its channels |
| `groups:ban` | Moves a user to the group's banned list |
| `groups:leave` | Allows a member to leave a group voluntarily |

### Channels

| Event | Description |
|-------|-------------|
| `channels:create` | Creates a new channel (admin or super admin only) |
| `channels:delete` | Deletes a channel (admin or super admin only) |
| `channels:join` | Adds a user to a channel's membership |
| `channels:leave` | Removes a user from a channel's membership |
| `channels:message` | Appends a message to a channel and broadcasts it |
| `channels:getMessages` | Retrieves persisted messages for a channel |

### Users & Roles

| Event | Description |
|-------|-------------|
| `users:promote` | Assigns or updates user roles (e.g., promotes to group admin or super admin) |
| `users:delete` | Deletes a user globally and cleans up related data |

### Reports

| Event | Description |
|-------|-------------|
| `reports:create` | Allows an admin to report a member, making the report visible to super admins |

## Client ↔ Server Flow

### Startup

1. Client emits `groups:getAll` to fetch all groups
2. Server responds with `groups:update`, refreshing Angular signals to update the UI

### Join Channel

1. Client emits `channels:join` to join a channel
2. Server updates channel membership, adds a system message, and broadcasts the update to all clients

### Send Message

1. Client emits `channels:message` with the message content
2. Server appends the message to the channel's message list and broadcasts it to all clients
3. Client UI re-renders to display the new message

### Admin Actions

1. Actions like approving join requests, banning, or removing members are emitted to the server
2. Server mutates the global state and broadcasts updates to all connected clients

## Authentication & Authorization

### Login/Register

- **UserService** manages user authentication and registration
- Initial user seed includes a default super admin (e.g., username: `super`, password: `123`)

### Session Management

- Successful login stores user data in `sessionStorage`
- Logout clears `sessionStorage` and redirects to `/login`

### Guarded UI

- **AuthGuard** checks user roles to restrict route access
- Angular templates use role-based conditions to show/hide actions (e.g., admin-only buttons)

### Role Updates

- Server emits `users:roleUpdate` when a user's role changes
- Client merges the update into its local state for real-time synchronization

## Role Abilities

### Super Admin

- Inherits all group admin privileges
- Can promote or demote users (e.g., assign `groupAdmin` or `superAdmin` roles)
- Can remove any user from the system
- Can view all reports across all groups

### Group Admin

- Manages groups they own or administer
- Can create/delete channels within their groups
- Can approve or decline join requests
- Can ban or remove members from their groups
- Can report users to super admins

### Chat User

- Can register and log in
- Can join or leave groups
- Can send messages in channels they are part of
- Can delete their own account

## REST Mapping (Future Plan)

The following table outlines planned REST endpoints to complement or replace Socket.IO events:

| Socket.IO Event | REST Endpoint | HTTP Method | Purpose |
|----------------|---------------|-------------|---------|
| `groups:getAll` | `/api/groups` | GET | Fetch all groups |
| `groups:create` | `/api/groups` | POST | Create a new group |
| `groups:delete` | `/api/groups/:id` | DELETE | Delete a group |
| `groups:requestJoin` | `/api/groups/:id/requests` | POST | Request to join a group |
| `groups:approveJoin` | `/api/groups/:id/requests/:username/approve` | POST | Approve a join request |
| `channels:create` | `/api/groups/:id/channels` | POST | Create a channel |
| `channels:message` | `/api/groups/:gid/channels/:cid/messages` | POST | Send a message to a channel |

---

This documentation provides a clear and structured overview of the application's architecture, data models, and workflows, serving as a foundation for development, maintenance, and future enhancements.
