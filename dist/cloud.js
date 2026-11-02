import { CLOUD_URL, CLOUD_KEY } from './config.js';
let client;
export function getClient() {
  if (!client) {
    if (!window.supabase)
      throw Error(
        'Cloud connection is unavailable. Your device workspace still works.',
      );
    client = window.supabase.createClient(CLOUD_URL, CLOUD_KEY, {
      auth: {
        storageKey: 'rr-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
export async function session() {
  return (await getClient().auth.getSession()).data.session;
}
export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}
export async function signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await getClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}
export async function list() {
  const { data, error } = await getClient()
    .from('rr_workspaces')
    .select('id,title,version,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function load(id) {
  const { data, error } = await getClient()
    .from('rr_workspaces')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
export async function save(room, expectedVersion) {
  if (new Blob([JSON.stringify(room)]).size > 2000000) {
    throw Error(
      'This room is too large for one cloud copy. Export a backup, then use fewer snapshots or split the room.',
    );
  }
  const s = await session();
  if (!s) throw Error('Sign in to save a private cloud copy.');
  const payload = {
    id: room.id,
    user_id: s.user.id,
    title: room.title,
    data: room,
    version: (expectedVersion || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  if (expectedVersion) {
    const { data, error } = await getClient()
      .from('rr_workspaces')
      .update(payload)
      .eq('id', room.id)
      .eq('version', expectedVersion)
      .select('version');
    if (error) throw error;
    if (!data?.length)
      throw Error(
        'This room changed on another device. Load its cloud copy or save a duplicate.',
      );
    return data[0].version;
  }
  const { data, error } = await getClient()
    .from('rr_workspaces')
    .insert(payload)
    .select('version');
  if (error) {
    if (error.code === '23505')
      throw Error(
        'A cloud copy already exists. Load it first, or duplicate this room.',
      );
    throw error;
  }
  return data[0].version;
}
export async function remove(id) {
  const { error } = await getClient()
    .from('rr_workspaces')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
