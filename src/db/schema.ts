import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// --- Auth.js required tables (schema shape mandated by @auth/drizzle-adapter) ---

export const users = sqliteTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// --- KinBoard household data ---

export const householdMembers = sqliteTable('household_member', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  color: text('color').notNull().default('#38bdf8'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const calendars = sqliteTable('calendar', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  googleCalendarId: text('google_calendar_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#a78bfa'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const calendarEvents = sqliteTable('calendar_event', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  memberId: text('member_id').references(() => householdMembers.id, { onDelete: 'set null' }),
});

export const chores = sqliteTable('chore', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  category: text('category').notNull().default('General'),
  memberId: text('member_id').references(() => householdMembers.id, {
    onDelete: 'set null',
  }),
  frequency: text('frequency', { enum: ['daily', 'weekly'] })
    .notNull()
    .default('daily'),
  sortOrder: integer('sort_order').notNull().default(0),
  rotationMemberId: text('rotation_member_id').references(() => householdMembers.id, { onDelete: 'set null' }),
  rewardPoints: integer('reward_points').notNull().default(1),
  rewardCents: integer('reward_cents').notNull().default(0),
  bounty: integer('bounty', { mode: 'boolean' }).notNull().default(false),
});

// One row per (chore, period key) marks completion. periodKey is an ISO date
// (YYYY-MM-DD) for daily chores or an ISO week (YYYY-Www) for weekly chores,
// so "reset" is just letting the key roll over rather than mutating state.
export const choreCompletions = sqliteTable(
  'chore_completion',
  {
    choreId: text('chore_id')
      .notNull()
      .references(() => chores.id, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (cc) => [primaryKey({ columns: [cc.choreId, cc.periodKey] })],
);

export const choreClaims = sqliteTable('chore_claim', {
  choreId: text('chore_id').primaryKey().references(() => chores.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  claimedAt: integer('claimed_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const memberStatuses = sqliteTable('member_status', {
  memberId: text('member_id').primaryKey().references(() => householdMembers.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const meals = sqliteTable('meal', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  date: text('date').notNull(), // ISO date YYYY-MM-DD
  mealType: text('meal_type', { enum: ['breakfast', 'lunch', 'dinner'] }).notNull(),
  description: text('description').notNull().default(''),
});

export const stickyNotes = sqliteTable('sticky_note', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  color: text('color').notNull().default('#facc15'),
  authorName: text('author_name'),
  mediaUrl: text('media_url'),
  mediaType: text('media_type', { enum: ['image', 'audio', 'drawing'] }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const DASHBOARD_WIDGETS = ['clock', 'weather', 'calendar', 'meals', 'chores', 'notes'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];

// Single-household settings singleton (id is always 'default'). Multi-household
// support in Phase 3 will key this by household id instead.
export const dashboardSettings = sqliteTable('dashboard_settings', {
  id: text('id').primaryKey().default('default'),
  // Ordered list of enabled widget ids; anything from DASHBOARD_WIDGETS not
  // present here is simply hidden.
  widgetOrder: text('widget_order', { mode: 'json' })
    .notNull()
    .$type<DashboardWidgetId[]>()
    .default(sql`'["clock","weather","calendar","meals","chores","notes"]'`),
  refreshSeconds: integer('refresh_seconds').notNull().default(300),
  theme: text('theme', { enum: ['light', 'dark'] }).notNull().default('dark'),
  timezone: text('timezone').notNull().default('auto'),
  widgetSizes: text('widget_sizes', { mode: 'json' })
    .notNull()
    .$type<Partial<Record<DashboardWidgetId, '1x1' | '2x1' | '2x2'>>>()
    .default(sql`'{"clock":"1x1","weather":"2x1","calendar":"2x2","meals":"1x1","chores":"2x1","notes":"1x1"}'`),
});
