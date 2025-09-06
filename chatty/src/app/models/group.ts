import { Channel } from "./channel";

export interface Group {
  id: string;
  name: string;
  createdBy?: string;   // userId of the creator
  admins: string[]; // array of userIds who are admins
  members: string[]; // array of userIds who are members
  bannedMembers: string[]; // array of userIds who are banned
  channels: Channel[];
  joinRequests: string[];
}
