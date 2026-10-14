export type AuditAction = "Created" | "Updated" | "Deleted";
export type AuditEntityType = "Product" | "Category" | "User";

export interface AuditLog {
  id: number;
  userId: number;
  actorName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number | null;
  entityName: string;
  details: string | null;
  createdAt: string;
}

export interface ActivityQueryParams {
  scope?: "mine" | "all";
  entityType?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}
