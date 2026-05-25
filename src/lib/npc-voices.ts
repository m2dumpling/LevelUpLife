/**
 * NPC 朋友圈 — 打卡后随机生成搞笑话
 *
 * 根据任务类型、难度、时间、连击天数和上下文生成评论。
 * 前端可直接 import 使用，零依赖。
 */

type VoiceContext = {
  mode: "habit" | "plan";
  difficulty: string;
  title: string;
  streak: number;
  hour: number;
  isUndo?: boolean;
};

const DIALOGUES = {
  complete: {
    habit: {
      easy: [
        "💧 水滴精灵：涓涓细流，也能汇成大海。",
        "🐢 龟长老：慢慢来，比较快。",
        "🌱 小草：今天我又长高了一微米！",
      ],
      medium: [
        "⚔️ 剑术大师：这一剑，有进步。",
        "🏃 风行者：步伐稳了，继续跑。",
        "📖 智者：知识就是力量，你今天又强了一分。",
      ],
      hard: [
        "🔥 火焰领主：干得漂亮！这股热量我感受到了。",
        "💪 肌肉精灵：明天练腿。",
        "🗡️ 暗影刺客：一击毙命，干净利落。",
      ],
      heroic: [
        "🐉 远古巨龙：有意思。你引起了我的注意。",
        "👑 国王：王国需要更多像你这样的人。",
        "⚡ 雷神：这一击，惊天动地！",
      ],
    },
    plan: {
      easy: ["✅ 任务清单又划掉一项。满足。", "📋 事务官：记录在案，完成。"],
      medium: ["🎯 狙击手：正中靶心。", "🏆 竞技场主持人：又一个挑战者成功了！"],
      hard: ["💼 大法师：这个任务不简单，但你做到了。", "🗿 石像鬼：...（点了点头）"],
      heroic: ["🌟 星辰使者：传奇任务完成！你的名字将被传唱。", "🎪 命运之轮：这一转，改变了你的命运。"],
    },
    // 根据连击的特殊对话
    streak: [
      "🔥 连续 {n} 天！火焰领主给你点了个赞。",
      "⭐ 你已经连续打卡 {n} 天了，星辰在为你闪烁。",
      "💎 神秘商人悄悄塞给你一个小布袋...（里面是空气，但心意到了）",
    ],
    // 根据时间的特殊对话
    morning: [
      "🌅 晨曦女神：早起的人儿有 XP 吃。",
      "☕ 咖啡贤者：趁世界还没醒，先把自己变强。",
    ],
    evening: [
      "🌙 夜精灵：黑暗中的努力，黎明时会发光。",
      "🦉 猫头鹰长老：深夜打卡，你是个狠人。",
    ],
    planDone: ["📅 日期到了，使命完成。你兑现了承诺。", "⏰ 时间不会辜负守信的人。"],
  },
  undo: {
    habit: [
      "⏪ 时光术士：时间倒流了？不过没关系，明天再来。",
      "🔄 命运之轮：反转了。但命运还会再给你机会。",
    ],
    plan: [
      "📝 档案管理员：记录已撤销。下次加油。",
      "🕰️ 时光老人：计划赶不上变化，理解。",
    ],
  },
  idle: [
    "💤 暗影魔王在你床底偷笑：今天又躺了哈？",
    "🦥 树懒：我理解你。真的。",
    "👻 懒惰幽灵飘过：明天一定...对吧？",
    "🗿 石像鬼睁开眼睛看了看你，又闭上了。",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getNPCVoice(ctx: VoiceContext): string {
  const { mode, difficulty, streak, hour, isUndo } = ctx;

  // 撤销对话
  if (isUndo) {
    const pool = mode === "plan" ? DIALOGUES.undo.plan : DIALOGUES.undo.habit;
    return pick(pool);
  }

  // 连击特殊对话（≥7天，40% 概率触发）
  if (streak >= 7 && Math.random() < 0.4) {
    return pick(DIALOGUES.complete.streak).replace("{n}", String(streak));
  }

  // 时段特殊对话（20% 概率）
  if (Math.random() < 0.2) {
    if (hour < 10) return pick(DIALOGUES.complete.morning);
    if (hour >= 20) return pick(DIALOGUES.complete.evening);
  }

  // Plan 专属（20% 概率）
  if (mode === "plan" && Math.random() < 0.2) {
    return pick(DIALOGUES.complete.planDone);
  }

  // 难度对话
  const diff = (difficulty || "easy") as keyof typeof DIALOGUES.complete.habit;
  const pools = DIALOGUES.complete[mode === "plan" ? "plan" : "habit"];
  return pick(pools[diff] || pools.easy);
}
