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
});
