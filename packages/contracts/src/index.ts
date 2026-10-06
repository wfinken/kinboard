import type { AdminPage, AdminSection, AdminMutationResult, FamilyInvite } from './admin';
export * from './admin';
/** Transport-only types. Never import database models or server secrets here. */
export type Feature = 'calendars' | 'chores' | 'meals' | 'notes' | 'allowance' | 'family';
export type Grants = Record<Feature, { create: boolean; read: boolean; update: boolean; delete: boolean }>;
export interface ApiError { error: { code: string; message: string } }
export interface Viewer { id: string; name: string | null; image: string | null }
export interface Member { id: string; name: string; color: string; status: string }
export interface Chore {
  id: string; title: string; memberId: string | null; frequency: 'daily' | 'weekly';
  completed: boolean; bounty: boolean; allowanceEnabled: boolean; maxBidCents: number; rewardType: 'xp' | 'allowance'; rewardPoints: number; rewardCents: number;
}
export interface Note { id: string; content: string; color: string; authorName: string | null; createdAt: string }
export interface Meal { id: string; date: string; mealType: 'breakfast' | 'lunch' | 'dinner'; description: string }
export interface CalendarEvent { id: string; calendarId: string; title: string; start: string; end: string; allDay: boolean; color: string; memberName?: string; location?: string; description?: string }
export interface Dashboard {
  user: Viewer;
  family: { id: string; name: string };
  permissions: Grants;
  settings: { theme: 'light' | 'dark'; timezone: string; refreshSeconds: number; widgetOrder: string[]; widgetSizes: Record<string, string> };
  members: Member[]; chores: Chore[]; meals: Meal[]; notes: Note[]; events: CalendarEvent[];
  weather: null | { currentTemp: number; currentCode: number; feelsLike: number; humidity: number; windSpeed: number; today: { high: number; low: number; precipChance: number }; forecast: Array<{ date: string; high: number; low: number; code: number }> };
  allowance: { balanceCents: number; bids: Array<{ id: string; choreId: string; memberId: string; amountCents: number; status: 'pending' | 'approved' | 'rejected' | 'paid' }> };
  latest: Array<{ kind: string; title: string; detail: string; at: string; icon: string }>;
}
export interface CreateNote { content: string; color?: string }
export interface CompleteChore { completed: boolean; memberId?: string }
export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function createClient(baseUrl = '', transport: typeof fetch = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await transport(`${baseUrl}/api/v1${path}`, { ...init, credentials: baseUrl ? 'include' : 'same-origin', headers: { Accept: 'application/json', ...(init.method && init.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as ApiError | null;
      throw new ApiClientError(response.status, body?.error?.code ?? 'request_failed', body?.error?.message ?? 'Request failed. Please try again.');
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  return {
    admin: <S extends AdminSection>(section: S) => request<AdminPage<S>>(`/admin/${section}`),
    async adminForm(path: string, body: FormData): Promise<AdminMutationResult> {
      if (!path.startsWith('/api/admin/')) throw new Error('Invalid admin action.');
      const response = await transport(`${baseUrl}${path}`, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body });
      const result = await response.json().catch(() => null) as AdminMutationResult | ApiError | null;
      if (!response.ok || !result || 'error' in result) {
        const error = result && 'error' in result ? result.error : null;
        throw new ApiClientError(response.status, error?.code ?? 'request_failed', error?.message ?? 'Could not save. Please try again.');
      }
      return result;
    },
    async invite(): Promise<FamilyInvite> {
      const response = await transport(`${baseUrl}/api/family/invite`, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
      const body = await response.json() as FamilyInvite | ApiError;
      if (!response.ok || 'error' in body) throw new ApiClientError(response.status, 'request_failed', 'error' in body ? body.error.message : 'Could not create invite.');
      return body;
    },
    dashboard: () => request<Dashboard>('/dashboard'),
    createNote: (note: CreateNote) => request<Note>('/notes', { method: 'POST', body: JSON.stringify(note) }),
    deleteNote: (id: string) => request<void>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    completeChore: (id: string, input: CompleteChore) => request<void>(`/chores/${encodeURIComponent(id)}/completion`, { method: 'PUT', body: JSON.stringify(input) }),
  };
}
