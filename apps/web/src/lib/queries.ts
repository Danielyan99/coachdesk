import type {
  AdherenceDto,
  AssignTemplateInput,
  AuthUser,
  ClientDto,
  ClientPlanDto,
  ClientPlanInput,
  ClientPlanResponse,
  CreateClientInput,
  DashboardDto,
  InviteLinkDto,
  LoginInput,
  SignupInput,
  TemplateDto,
  TemplateInput,
  Tier,
  UpdateClientInput,
} from '@coachdesk/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { whenServerReady } from './serverStatus';

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  plan: (clientId: string) => ['clients', clientId, 'plan'] as const,
  adherence: (clientId: string) => ['clients', clientId, 'adherence'] as const,
  templates: ['templates'] as const,
  template: (id: string) => ['templates', id] as const,
};

// ---------- Auth ----------

/** The logged-in user, or null when logged out (a 401 is an answer here, not an error). */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<AuthUser>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

function useSetSession() {
  const qc = useQueryClient();
  return (user: AuthUser | null) => {
    // A different user may log in on the same tab: drop everything cached for the previous one.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    qc.setQueryData(keys.me, user);
  };
}

export function useLogin() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: LoginInput) => api<AuthUser>('/auth/login', { method: 'POST', body }),
    onSuccess: setSession,
  });
}

export function useSignup() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: SignupInput) => api<AuthUser>('/auth/signup', { method: 'POST', body }),
    onSuccess: setSession,
  });
}

export function useAcceptInvite(token: string) {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<AuthUser>(`/auth/invite/${token}/accept`, { method: 'POST', body }),
    onSuccess: setSession,
  });
}

/** Creates a private demo sandbox on the server and logs in as its trainer or client. */
export function useStartDemo() {
  const setSession = useSetSession();
  return useMutation({
    // Wait for a sleeping server to wake up first, so the request doesn't time out at the proxy.
    mutationFn: async (role: 'trainer' | 'client') => {
      await whenServerReady();
      return api<AuthUser>('/auth/demo', { method: 'POST', body: { role } });
    },
    onSuccess: setSession,
  });
}

export function useLogout() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => setSession(null),
  });
}

export function useSwitchTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tier: Tier) => api<AuthUser>('/me/tier', { method: 'PATCH', body: { tier } }),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

// ---------- Clients ----------

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api<DashboardDto>('/dashboard') });
}

export function useClients() {
  return useQuery({ queryKey: keys.clients, queryFn: () => api<ClientDto[]>('/clients') });
}

export function useClient(id: string) {
  return useQuery({ queryKey: keys.client(id), queryFn: () => api<ClientDto>(`/clients/${id}`) });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientInput) => api<ClientDto>('/clients', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.dashboard });
      void qc.invalidateQueries({ queryKey: keys.clients });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClientInput) => api<ClientDto>(`/clients/${id}`, { method: 'PATCH', body }),
    onSuccess: (client) => {
      qc.setQueryData(keys.client(id), client);
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useArchiveClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.dashboard });
      void qc.invalidateQueries({ queryKey: keys.clients });
    },
  });
}

export function useCreateInvite(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<InviteLinkDto>(`/clients/${id}/invite`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.client(id) }),
  });
}

export function useAdherence(clientId: string) {
  return useQuery({
    queryKey: keys.adherence(clientId),
    queryFn: () => api<AdherenceDto>(`/clients/${clientId}/adherence`),
  });
}

// ---------- Plans ----------

export function useClientPlan(clientId: string) {
  return useQuery({
    queryKey: keys.plan(clientId),
    queryFn: async () => (await api<ClientPlanResponse>(`/clients/${clientId}/plan`)).plan,
  });
}

export function useSavePlan(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientPlanInput) => api<ClientPlanDto>(`/clients/${clientId}/plan`, { method: 'PUT', body }),
    onSuccess: (plan) => {
      qc.setQueryData(keys.plan(clientId), plan);
      void qc.invalidateQueries({ queryKey: keys.adherence(clientId) });
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

// ---------- Templates ----------

export function useTemplates() {
  return useQuery({ queryKey: keys.templates, queryFn: () => api<TemplateDto[]>('/templates') });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: keys.template(id ?? 'new'),
    queryFn: () => api<TemplateDto>(`/templates/${id}`),
    enabled: Boolean(id),
  });
}

export function useSaveTemplate(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TemplateInput) =>
      id
        ? api<TemplateDto>(`/templates/${id}`, { method: 'PATCH', body })
        : api<TemplateDto>('/templates', { method: 'POST', body }),
    onSuccess: (template) => {
      qc.setQueryData(keys.template(template.id), template);
      void qc.invalidateQueries({ queryKey: keys.templates });
    },
  });
}

export function useDeleteTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates }),
  });
}

export function useAssignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, ...body }: AssignTemplateInput & { templateId: string }) =>
      api<ClientPlanDto>(`/templates/${templateId}/assign`, { method: 'POST', body }),
    onSuccess: (plan) => {
      qc.setQueryData(keys.plan(plan.clientId), plan);
      void qc.invalidateQueries({ queryKey: keys.adherence(plan.clientId) });
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}
