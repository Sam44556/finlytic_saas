import { supabase } from './supabase/client';

async function getAuthHeaders() {
  const { data: { session: s0 } } = await supabase.auth.getSession();
  const now = Math.floor(Date.now() / 1000);
  const expiring =
    s0?.expires_at != null && s0.expires_at < now + 120;
  if (!s0?.access_token || expiring) {
    await supabase.auth.refreshSession().catch(() => {});
  }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Transactions
export const transactionsApi = {
  getAll: () => apiRequest('/transactions'),
  create: (data: any) => apiRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/transactions/${id}`, {
    method: 'DELETE',
  }),
};

// Budgets
export const budgetsApi = {
  getAll: () => apiRequest('/budgets'),
  upsert: (data: any) => apiRequest('/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/budgets/${id}`, {
    method: 'DELETE',
  }),
};

// Goals
export const goalsApi = {
  getAll: () => apiRequest('/goals'),
  create: (data: any) => apiRequest('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/goals/${id}`, {
    method: 'DELETE',
  }),
};

// Profile
export const profileApi = {
  get: () => apiRequest('/profiles'),
  update: (data: any) => apiRequest('/profiles', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// AI Assistant
export const assistantApi = {
  chat: (message: string) => apiRequest('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
};

// Stripe
export const stripeApi = {
  createCheckout: (priceId: string, userId: string) => 
    apiRequest<{ url: string }>('/stripe/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId, userId }),
    }),
};
