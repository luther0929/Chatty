export interface Channel {
  id: string;
  name: string;
  users: string[]; // optional: list of usernames in the channel
  messages: string[];
}