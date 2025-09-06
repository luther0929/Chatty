export interface Report {
  id: string;
  groupId: string;
  member: string;     // reported member username
  reportedBy: string; // admin username
  text: string;       // report text
  timestamp: number;  // Date.now()
}
