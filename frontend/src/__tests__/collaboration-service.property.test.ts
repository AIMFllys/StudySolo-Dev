import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authedFetchMock, parseApiErrorMock } = vi.hoisted(() => ({
  authedFetchMock: vi.fn(),
  parseApiErrorMock: vi.fn(),
}));

vi.mock('@/services/api-client', () => ({
  authedFetch: authedFetchMock,
  parseApiError: parseApiErrorMock,
}));

import {
  acceptInvitation,
  fetchCollaborators,
  fetchPendingInvitations,
  fetchSharedWorkflows,
  inviteCollaborator,
  rejectInvitation,
  removeCollaborator,
} from '@/services/collaboration.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('collaboration service', () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    parseApiErrorMock.mockResolvedValue('request failed');
  });

  it('routes collaborator mutations through authedFetch', async () => {
    authedFetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await inviteCollaborator('wf-1', 'user@example.com');
    await removeCollaborator('wf-1', 'user-1');
    await acceptInvitation('inv-1');
    await rejectInvitation('inv-2');

    expect(authedFetchMock).toHaveBeenNthCalledWith(1, '/api/workflow/wf-1/collaborators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', role: 'editor' }),
    });
    expect(authedFetchMock).toHaveBeenNthCalledWith(2, '/api/workflow/wf-1/collaborators/user-1', {
      method: 'DELETE',
    });
    expect(authedFetchMock).toHaveBeenNthCalledWith(3, '/api/workflow/invitations/inv-1/accept', {
      method: 'POST',
    });
    expect(authedFetchMock).toHaveBeenNthCalledWith(4, '/api/workflow/invitations/inv-2/reject', {
      method: 'POST',
    });
  });

  it('returns empty lists when collaboration reads fail', async () => {
    authedFetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(fetchCollaborators('wf-1')).resolves.toEqual([]);
    await expect(fetchPendingInvitations()).resolves.toEqual([]);
    await expect(fetchSharedWorkflows()).resolves.toEqual([]);
  });

  it('returns collaboration read payloads unchanged on success', async () => {
    authedFetchMock
      .mockResolvedValueOnce(jsonResponse([{ id: 'col-1' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'inv-1' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'wf-1' }]));

    await expect(fetchCollaborators('wf-1')).resolves.toEqual([{ id: 'col-1' }]);
    await expect(fetchPendingInvitations()).resolves.toEqual([{ id: 'inv-1' }]);
    await expect(fetchSharedWorkflows()).resolves.toEqual([{ id: 'wf-1' }]);
  });
});
