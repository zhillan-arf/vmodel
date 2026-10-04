export const bundledAvatars = [
  { id: 'ene', packageVersion: undefined, name: 'Ene', label: 'Ene · Cyber legs', url: '/avatars/ene.vrm' },
  { id: 'rei', packageVersion: '1.3.3', name: 'Rei', label: 'Rei · Adachi Rei', url: '/avatars/rei.vrm' },
] as const;

export function savedAvatar() {
  try { return bundledAvatars.find(avatar => avatar.id === localStorage.getItem('vmodel-avatar')) ?? bundledAvatars[0]; }
  catch { return bundledAvatars[0]; }
}
