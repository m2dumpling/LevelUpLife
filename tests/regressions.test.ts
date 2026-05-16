import assert from "node:assert/strict";

import { formatBeijingDate } from "../src/lib/date-utils.ts";
import {
  applyRewards,
  levelStateFromTotalXp,
  totalXpFromLevelState,
} from "../src/lib/xp-calculator.ts";

{
  const losAngelesEvening = new Date("2026-05-12T18:30:00-07:00");

  assert.equal(formatBeijingDate(losAngelesEvening), "2026-05-13");
}

{
  const user = { xp: 95, xpToNext: 100, level: 1, gold: 3, hp: 100 };
  const rewarded = applyRewards(user, 10, 3);

  assert.equal(rewarded.level, 2);
  assert.equal(rewarded.xp, 5);
  assert.equal(rewarded.gold, 6);
  assert.equal(rewarded.xpEarned, 10);

  const reverted = levelStateFromTotalXp(
    totalXpFromLevelState(rewarded.level, rewarded.xp) - rewarded.xpEarned
  );

  assert.deepEqual(reverted, {
    level: 1,
    xp: 95,
    xpToNext: 100,
  });
}

console.log("regressions ok");
