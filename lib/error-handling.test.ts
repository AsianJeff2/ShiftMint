// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from './api-client';
import { errorMessage, handleApiError } from './error-handling';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('actionable server errors through the real API client', () => {
  it('retains bootstrap permission reasons returned by an HTTP 403', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'A valid workspace setup code is required' }), { status: 403 })));
    await expect(apiClient.getPosConnections()).rejects.toMatchObject({ message: 'A valid workspace setup code is required', userMessage: 'A valid workspace setup code is required' });
  });
  it('retains conflict details needed to review overlapping shifts', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = handleApiError({ status: 422, response: { message: 'Review overlapping work shifts', shiftIds: ['shift-a', 'shift-b'] } });
    expect(errorMessage(result)).toBe('Review overlapping work shifts Shift IDs: shift-a, shift-b.');
    expect(result.details).toEqual({ message: 'Review overlapping work shifts', shiftIds: ['shift-a', 'shift-b'] });
  });
  it('handles plain AppError objects and hides server-internal 500 messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(errorMessage({ userMessage: 'Reopen the period first', message: 'Internal context' })).toBe('Reopen the period first');
    const result = handleApiError({ status: 500, response: { message: 'SQL database credentials at private/path' } });
    expect(errorMessage(result)).not.toContain('private/path');
  });
});
