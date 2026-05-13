export interface RewardSnapshot {
  xp: number;
  xpToNext: number;
  level: number;
  gold: number;
  hp: number;
}

export function deductTaskGold(
  currentUser: RewardSnapshot,
  taskGold: number,
): RewardSnapshot {
  return {
    ...currentUser,
    gold: Math.max(0, currentUser.gold - taskGold),
  };
}
