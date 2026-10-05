export const bundledAvatars = [
  { id: 'ene', packageVersion: undefined, name: 'Ene', label: 'Ene · Cyber legs', url: '/avatars/ene.vrm' },
  { id: 'rei', packageVersion: '1.3.3', name: 'Rei', label: 'Rei · Adachi Rei', url: '/avatars/rei.vrm' },
  { id: 'rei-v2', packageVersion: '2.0.0-candidate.1', name: 'Rei v2', label: 'Rei v2 · Appearance test', url: '/avatars/rei-v2.vrm' },
  { id: 'ene-v2', packageVersion: '2.0.0-candidate.1', name: 'Ene v2', label: 'Ene v2 · Appearance test', url: '/avatars/ene-v2.vrm' },
] as const;

export function savedAvatar() {
  try { return bundledAvatars.find(avatar => avatar.id === localStorage.getItem('vmodel-avatar')) ?? bundledAvatars[0]; }
  catch { return bundledAvatars[0]; }
}
