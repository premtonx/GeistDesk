export type TicketStatus =
  | 'open'
  | 'pending'
  | 'resolved'
  | 'closed'
  | 'deleted'
  | 'spam'
  | 'merged'
  | 'trash'
  | 'qs'
  | 'paused'
  | 'on-hold'
  | 'on_hold'
  | 'waiting_customer'
  | 'waiting_dev'
  | 'waiting_vendor';
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type SenderType = "customer" | "agent" | "ai";

export interface Permission {
  id: string;
  moduleId: string;
  action: 'view' | 'create' | 'edit' | 'delete' | 'admin';
  granted: boolean;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: {
    [moduleId: string]: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      admin: boolean;
    };
  };
  specialPermissions: {
    overridePIIShield: boolean;
    manageModelOrchestrator: boolean;
    bypass2FA: boolean;
    aiGovernance: boolean;
  };
  isSystem?: boolean;
  userCount?: number;
  visibilityScope?: 'all' | 'assigned';
  is_admin?: boolean;
  can_create_tickets?: boolean;
  can_view_knowledgebase?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent" | "team_lead" | "customer";
  avatar?: string;
  signature?: string;
  visibilityScope?: 'all' | 'group' | 'assigned';
  roleId?: string; // Links to RBAC definitions
  groups?: string[]; // IDs of functional groups
  isDeactivated?: boolean;
  agentType?: 'full-time' | 'occasional';
  is_admin?: boolean;
  can_create_tickets?: boolean;
  can_view_knowledgebase?: boolean;
  lastActiveAt?: any;
  createdAt: any;
  updatedAt?: any;
  password?: string;
  authMethod?: 'sso' | 'password';
  personalVaultInitialized?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  businessHoursId?: string;
  isDefault?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  tier: "Free" | "Pro" | "Enterprise";
  location: string;
  status: "active" | "inactive";
  createdAt: any;
}

export interface PresenceAgent {
  uid: string;
  name: string;
  avatar?: string;
  lastActive: any;
}

export interface Company {
  id: string;
  logoUrl?: string;
  name: string;
  website?: string;
  domain: string;
  branche: "Tech" | "Finance" | "Healthcare" | "Manufacturing" | "Retail" | "Services" | "Other";
  wartungsvertragStatus: "Active" | "Expired" | "None";
  phoneNumbers: string[];
  createdAt: any;
  updatedAt?: any;
}

export interface Contact {
  id: string;
  companyId: string;
  title?: string;
  name: string;
  email: string;
  phoneWork?: string;
  phoneMobile?: string;
  socialHandles?: any;
  address?: string;
  metadata?: Record<string, any>;
  createdAt: any;
  updatedAt?: any;
}

export interface SupportTicket extends Omit<Ticket, 'id'> {
  id: string;
}

export interface TicketChecklistItem {
  id?: string;
  task: string;
  completed: boolean;
  source?: 'ai' | 'manual';
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  team: "support" | "engineering" | "legal";
  customerId?: string; // Kept for backward compatibility if needed, but we prefer contactId
  customerName?: string;
  contactId: string;
  companyId: string;
  company?: string;
  channel?: 'email' | 'chat' | 'phone' | 'whatsapp';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry';
  firstResponseDue?: any;
  mentions?: string[];
  creatorId?: string;
  isUndelivered?: boolean;
  agentId?: string;
  agentName?: string;
  groupId?: string;
  groupName?: string;
  parentId?: string;
  childIds?: string[];
  isHelpRequested?: boolean;
  sources?: { paragraph: string; articleTitle: string; articleId: string }[];
  createdAt: any;
  updatedAt: any;
  tags: string[];
  aiSentiment?: 'positive' | 'neutral' | 'negative' | 'angry' | 'happy';
  aiConfidence?: number;
  originalLanguage?: string;
  type?: 'question' | 'incident' | 'problem' | 'feature_request';
  ticketKind?: 'support' | 'bug';
  product?: 'GeistDeskTech' | 'GeistDeskMobile';
  slaDueAt?: any;
  slaTier?: string;
  accountHealth?: 'good' | 'bad' | 'at_risk' | string;
  affectedVersion?: string;
  environment?: string;
  stepsToReproduce?: string;
  devStatus?: 'backlog' | 'in_dev' | 'qa' | 'merged';
  resolvedAt?: any;
  closedAt?: any;
  linkedTicketIds?: string[];
  masterTicketId?: string | null;
  isMasterTicket?: boolean;
  mergedIntoId?: string;
  aiSuggestedDraft?: string;
  aiCitations?: string[];
  aiReasoningPath?: string;
  aiSummary?: string | null;
  aiInsights?: string[] | null;
  aiRootCause?: string | null;
  aiChecklist?: TicketChecklistItem[] | null;
  internalNotes?: string;
  activeAgents?: PresenceAgent[];
  agentComments?: AgentComment[];
}

export interface Message {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: SenderType;
  senderName?: string;
  content: string;
  originalContent?: string;
  redactedContent?: string;
  citations?: string[];
  reasoningPath?: string;
  createdAt: any;
  /** Outbound mail result — `saved_locally` when SMTP/dispatch is unavailable. */
  deliveryStatus?: 'delivered' | 'saved_locally' | 'pending';
  deliveryReason?: string | null;
}

export interface AgentComment {
  id: string;
  agentName: string;
  agentId: string;
  content: string;
  createdAt: any;
}

export interface KBTag {
  id: string;
  name: string;
  count: number;
}

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorId: string;
  visibility: "Public" | "Private";
  createdAt: any;
  updatedAt: any;
  owner?: string;
  reviewer?: string;
  lastEditor?: string;
  approvalStatus?: string;
  reviewDueDate?: string;
  status?: string; // 'Published' | 'Draft' | 'Needs Review' | 'Outdated' | 'Archived' | 'AI Generated' | 'Under Revision'
  views?: number;
  helpfulCount?: number;
  unhelpfulCount?: number;
  avgReadTime?: string;
  language?: string;
  parentCategory?: string;
  subCategory?: string;
  aiSummary?: string;
  alerts?: KBArticleAlert[];
  infrastructureTrust?: KBArticleInfrastructureTrust;
  workflowSteps?: KBArticleWorkflowStep[];
  translations?: Record<string, KBArticleTranslation>;
  linkedTicket?: string;
  trustScore?: number;
}

export type KBArticleAlertType = 'warning' | 'info' | 'success' | 'critical';

export interface KBArticleAlert {
  type: KBArticleAlertType;
  title: string;
  body: string;
}

export interface KBArticleInfrastructureTrust {
  reviewed?: boolean;
  technicallyVerified?: boolean;
  trustScore?: number;
  hallucinationRisk?: string;
  coverage?: string;
  freshness?: string;
}

export interface KBArticleWorkflowStep {
  id: string;
  label: string;
  status: 'complete' | 'active' | 'pending';
}

export interface KBArticleTranslation {
  title: string;
  content: string;
  alerts?: KBArticleAlert[];
}

export interface KBArticleHistoryEntry {
  id: string;
  articleId: string;
  authorId?: string;
  authorName?: string;
  changeSummary: string;
  snapshotTitle?: string;
  createdAt: any;
}

export type VaultItemType = 'secret' | 'request';

export interface VaultItem {
  id: string;
  type: VaultItemType;
  content?: string; // Encrypted for secrets
  shares?: string[]; // SSS shares if used
  sharesCount?: number;
  threshold?: number;
  expiresAt: any;
  expirationType: 'read' | 'time' | 'quota';
  maxViews?: number;
  viewCount?: number;
  isBurned: boolean;
  createdBy: string;
  createdAt: any;
  passphraseRequired?: boolean;
  metadata?: {
    isQuantumSafe?: boolean;
    pqcLevel?: number;
    filename?: string;
    size?: number;
    secretType?: string;
    deliveryOption?: string;
    relatedTicketId?: string;
    relatedCompanyId?: string;
    relatedAssetId?: string;
    targetRecipient?: string;
    requestName?: string;
    description?: string;
    acceptedTypes?: string[];
    uploadLimit?: string;
    virusScan?: boolean;
    malwareScan?: boolean;
    retentionPolicy?: string;
    maxViews?: number;
    expirationPreset?: string;
    shareViaEmail?: boolean;
    recipientEmails?: string[];
    notifyOnView?: boolean;
    ipRestrictionEnabled?: boolean;
    ipAllowlist?: string;
    passphraseEnabled?: boolean;
    domainWhitelistEnabled?: boolean;
    allowedEmailDomains?: string[];
    mfaRequired?: boolean;
    vaultKind?: 'dropzone_upload_bucket' | string;
    allowedTypes?: string[];
    maxSizeMb?: number;
    antivirusScan?: boolean;
    blockMaliciousHashes?: boolean;
    lastUploadAt?: string;
    uploadCount?: number;
  };
}

export interface VaultAuditLog {
  id: string;
  vaultId: string;
  action: 'create' | 'read' | 'burn' | 'delete';
  actorId: string;
  timestamp: any;
}

export type NotificationCategory = 'ticket' | 'security' | 'system';

export interface SystemNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  link?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: any;
  updatedAt?: any;
}
