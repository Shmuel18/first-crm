/**
 * Branded type primitives - make different ID strings distinct at compile time.
 *
 * Why: TypeScript's structural typing treats all `string` as interchangeable.
 * Two IDs (e.g. CaseId and BorrowerId) are both strings at runtime, but mixing
 * them in code is almost always a bug. Branded types tell the compiler:
 *   "this string is tagged - only treat it as CaseId where CaseId is expected."
 *
 * Zero runtime cost - the `__brand` field exists only in the type system.
 */

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

// ============= Entity IDs =============
// One per main DB table - use these wherever a row id is passed around.

export type CaseId = Brand<string, 'CaseId'>;
export type LeadId = Brand<string, 'LeadId'>;
export type BorrowerId = Brand<string, 'BorrowerId'>;
export type CaseBankId = Brand<string, 'CaseBankId'>;
export type DocumentId = Brand<string, 'DocumentId'>;
export type TaskId = Brand<string, 'TaskId'>;

// ============= Lookup IDs =============

export type StatusId = Brand<string, 'StatusId'>;
export type CaseTypeId = Brand<string, 'CaseTypeId'>;
export type BankId = Brand<string, 'BankId'>;
export type IncomeTypeId = Brand<string, 'IncomeTypeId'>;
export type DocumentCategoryId = Brand<string, 'DocumentCategoryId'>;

// ============= Auth IDs =============

export type UserId = Brand<string, 'UserId'>;
export type RoleId = Brand<string, 'RoleId'>;
export type PermissionId = Brand<string, 'PermissionId'>;

// ============= Casts (boundary helpers) =============
// Call these where untyped strings enter the system (DB rows, FormData, route params).
// Each is a one-liner - the type assertion is intentional and central.

export const asCaseId = (s: string): CaseId => s as CaseId;
export const asLeadId = (s: string): LeadId => s as LeadId;
export const asBorrowerId = (s: string): BorrowerId => s as BorrowerId;
export const asCaseBankId = (s: string): CaseBankId => s as CaseBankId;
export const asDocumentId = (s: string): DocumentId => s as DocumentId;
export const asTaskId = (s: string): TaskId => s as TaskId;
export const asStatusId = (s: string): StatusId => s as StatusId;
export const asCaseTypeId = (s: string): CaseTypeId => s as CaseTypeId;
export const asBankId = (s: string): BankId => s as BankId;
export const asIncomeTypeId = (s: string): IncomeTypeId => s as IncomeTypeId;
export const asDocumentCategoryId = (s: string): DocumentCategoryId =>
  s as DocumentCategoryId;
export const asUserId = (s: string): UserId => s as UserId;
export const asRoleId = (s: string): RoleId => s as RoleId;
export const asPermissionId = (s: string): PermissionId => s as PermissionId;
