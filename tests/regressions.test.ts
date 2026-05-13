import assert from "node:assert/strict";

import { formatBeijingDate } from "../src/lib/date-utils.ts";
import { deductTaskGold } from "../src/lib/reward-adjustments.ts";

{
  const losAngelesEvening = new Date("2026-05-12T18:30:00-07:00");

  assert.equal(formatBeijingDate(losAngelesEvening), "2026-05-13");
}

{
  const user = { xp: 20, xpToNext: 100, level: 1, gold: 3, hp: 100 };

  assert.deepEqual(deductTaskGold(user, 5), {
    xp: 20,
    xpToNext: 100,
    level: 1,
    gold: 0,
    hp: 100,
  });
}

console.log("regressions ok");
