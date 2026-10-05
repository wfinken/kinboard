import type { Grants, Viewer, Note, Meal } from './index';

export const ADMIN_SECTIONS = ['overview', 'calendars', 'meals', 'notes', 'layout', 'chores', 'allowance', 'family', 'permissions', 'account'] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export const WIDGETS = ['clock', 'weather', 'latest', 'calendar', 'meals', 'chores', 'availability', 'allowance', 'notes'] as const;
export type Widget = typeof WIDGETS[number];
export type WidgetSize = '1x1' | '2x1' | '3x1' | '1x2' | '2x2';
export interface DisplaySettings {
  widgetOrder: Widget[]; widgetSizes: Partial<Record<Widget, WidgetSize>>;
  refreshSeconds: number; theme: 'light' | 'dark'; timezone: string; defaultEventCalendarId: string;
}
export interface AdminMember { id: string; name: string; color: string; userId: string | null }
export interface AdminChore {
  id: string; title: string; category: string; memberId: string | null; rotationMemberId: string | null;
  frequency: 'daily' | 'weekly'; rewardType: 'xp' | 'allowance'; rewardPoints: number; rewardCents: number;
  bounty: boolean; allowanceEnabled: boolean; maxBidCents: number;
}
export interface AdminContext {
  user: Viewer & { email: string | null }; family: { id: string; name: string };
  permissions: Grants; owner: boolean; settings: DisplaySettings;
}
export interface AdminResources {
  overview: { stats: Array<{ label: string; value: string | number }>; attention: Array<{ label: string; section: AdminSection }> };
  calendars: {
    calendars: Array<{ id: string; name: string; color: string; enabled: boolean }>;
    members: AdminMember[]; writableCalendars: Array<{ id: string; name: string }>;
    hasEventWriteScope: boolean; timezone: string;
  };
  meals: { meals: Meal[] };
  notes: { notes: Array<Note & { mediaUrl: string | null; mediaType: 'image' | 'audio' | 'drawing' | null }> };
  layout: Record<string, never>;
  chores: { chores: AdminChore[]; members: AdminMember[]; goals: Array<{ id: string; title: string; memberId: string | null; targetPoints: number; earnedPoints: number }> };
  allowance: {
    balanceCents: number; reservedCents: number; availableCents: number;
    bids: Array<{ id: string; choreTitle: string; memberName: string; amountCents: number; status: 'pending' | 'approved' | 'rejected' | 'paid'; createdAt: string }>;
    ledger: Array<{ id: string; kind: 'deposit' | 'payout'; amountCents: number; memberName: string | null; note: string; createdAt: string }>;
    chores: AdminChore[];
  };
  family: { people: Array<{ userId: string; name: string | null; email: string | null; role: 'owner' | 'member' }>; members: AdminMember[] };
  permissions: { people: Array<{ userId: string; name: string | null; email: string | null; permissions: Grants }> };
  account: { googleConnected: boolean };
}
export type AdminPage<S extends AdminSection = AdminSection> = S extends AdminSection ? AdminContext & { section: S; data: AdminResources[S] } : never;
export interface AdminMutationResult { ok: true; message: string }
export interface FamilyInvite { token: string; url: string; directUrl: string; expiresAt: string }
