export function getAvatarColors(letter: string): { bg: string; text: string } {
  const ch = letter.toUpperCase();
  if ('AGMSY'.includes(ch)) return { bg: '#E8EDF2', text: '#3D5A7A' };
  if ('BHNTZ'.includes(ch)) return { bg: '#EDF2E8', text: '#3A6B3A' };
  if ('CIOU'.includes(ch))  return { bg: '#F2EDE8', text: '#7A5A3D' };
  if ('DJPV'.includes(ch))  return { bg: '#EDE8F2', text: '#5A3D7A' };
  if ('EKQW'.includes(ch))  return { bg: '#F2E8ED', text: '#7A3D5A' };
  if ('FLRX'.includes(ch))  return { bg: '#E8F2EF', text: '#2D6B5A' };
  return { bg: '#E8EDF2', text: '#3D5A7A' };
}
