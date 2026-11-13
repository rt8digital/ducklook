import { app } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

app.setName('DuckLook API Test');

async function run() {
  const providedDir = process.env.DUCKLOOK_TEST_DIR;
  const dataDir = providedDir
    ? path.resolve(providedDir)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'ducklook-test-'));
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DUCKLOOK_DATA_DIR = dataDir;

  const { handleApiCall } = await import('../server/api.ts');
  const { db } = await import('../server/db.ts');
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', p: string, body?: unknown) =>
    handleApiCall({ method, path: p, body: (body as Record<string, unknown>) ?? null });

  const empty = (await call('GET', '/api/bootstrap')) as {
    accounts: unknown[];
    folders: unknown[];
    settings: { signatureHtml: string };
  };
  assert.equal(empty.accounts.length, 0, 'fresh workspace has no accounts');
  assert.equal(empty.folders.length, 0, 'fresh workspace has no folders');
  assert.equal(empty.settings.signatureHtml, '', 'no demo signature is seeded');

  const created = (await call('POST', '/api/accounts', {
    name: 'Test Mailbox',
    email: 'test@example.com',
    protocol: 'pop3',
    incomingHost: '127.0.0.1',
    incomingPort: 1,
    incomingSecurity: 'none',
    incomingUser: 'test@example.com',
    incomingPass: 'secret',
    outgoingHost: '127.0.0.1',
    outgoingPort: 1,
    outgoingSecurity: 'none',
    outgoingUser: 'test@example.com',
    outgoingPass: 'secret',
    leaveOnServer: true,
  })) as { accountId: string; accounts: Array<{ id: string; isDefault: boolean }>; folders: Array<{ id: string; role: string }>; syncWarning: string | null };

  assert.equal(created.accounts.length, 1, 'account created');
  assert.equal(created.accounts[0].isDefault, true, 'first account is default');
  assert.equal(created.folders.length, 6, 'standard folders created');
  assert.ok(created.syncWarning, 'offline sync warning reported');

  const draft = (await call('POST', '/api/messages/draft', {
    accountId: created.accountId,
    to: [{ name: 'Recipient', address: 'recipient@example.com' }],
    subject: 'Local draft',
    htmlBody: '<p>Hello</p>',
    textBody: 'Hello',
  })) as { id: string };

  const listed = (await call('GET', `/api/messages?accountId=${created.accountId}&scope=all`)) as {
    messages: Array<{ id: string; subject: string; isDraft: boolean }>;
  };
  assert.equal(listed.messages.length, 1, 'draft listed');
  assert.equal(listed.messages[0].isDraft, true, 'draft flag set');

  const read = (await call('PATCH', `/api/messages/${draft.id}`, { isRead: true })) as {
    message: { isRead: boolean };
  };
  assert.equal(read.message.isRead, true, 'message read state updated');

  const event = (await call('POST', '/api/calendar', {
    accountId: created.accountId,
    title: 'Local event',
    startTs: Date.now(),
    endTs: Date.now() + 3_600_000,
  })) as { ok: boolean };
  assert.equal(event.ok, true, 'calendar event created');

  const contact = (await call('POST', '/api/contacts', {
    accountId: created.accountId,
    email: 'person@example.com',
    displayName: 'Person Example',
  })) as { ok: boolean };
  assert.equal(contact.ok, true, 'contact created');

  const task = (await call('POST', '/api/tasks', {
    accountId: created.accountId,
    title: 'Local task',
  })) as { ok: boolean };
  assert.equal(task.ok, true, 'task created');

  const rule = (await call('POST', '/api/rules', {
    accountId: created.accountId,
    name: 'Rule',
    conditionValue: 'example',
  })) as { ok: boolean };
  assert.equal(rule.ok, true, 'rule created');

  const settings = (await call('PATCH', '/api/settings', { theme: 'dark' })) as {
    settings: { theme: string };
  };
  assert.equal(settings.settings.theme, 'dark', 'settings persisted');

  const final = (await call('GET', '/api/bootstrap')) as {
    accounts: unknown[];
    events: unknown[];
    contacts: unknown[];
    tasks: unknown[];
    rules: unknown[];
    settings: { theme: string };
  };
  assert.equal(final.accounts.length, 1, 'account persisted');
  assert.equal(final.events.length, 1, 'event persisted');
  assert.equal(final.contacts.length, 1, 'contact persisted');
  assert.equal(final.tasks.length, 1, 'task persisted');
  assert.equal(final.rules.length, 1, 'rule persisted');
  assert.equal(final.settings.theme, 'dark', 'settings reloaded');

  if (providedDir) {
    const inbox = db
      .prepare("SELECT id FROM folders WHERE account_id = ? AND role = 'inbox' LIMIT 1")
      .get(created.accountId) as { id: string };
    db.prepare(
      'UPDATE messages SET folder_id = ?, is_draft = 0, is_read = 0, subject = ?, html_body = ?, text_body = ? WHERE id = ?'
    ).run(
      inbox.id,
      'Welcome to your local mailbox',
      '<p>This message lives in SQLite on this computer.</p><p>Use the ribbon to reply, flag, archive, or delete it.</p>',
      'This message lives in SQLite on this computer.',
      draft.id
    );
  }

  db.close();
  if (!providedDir) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  console.log('API TEST PASSED');
  app.exit(0);
}

app.whenReady().then(run).catch((err) => {
  console.error('API TEST FAILED', err);
  app.exit(1);
});
