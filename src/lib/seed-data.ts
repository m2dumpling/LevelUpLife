/**
 * 预置数据：成就 + 主线剧情
 */

export interface SeedAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  isHidden: boolean;
}

export interface SeedStoryEvent {
  chapterKey: string;
  triggerCondition: string; // JSON
  title: string;
  dialogue: string;
  npcName: string;
  reward: string | null; // JSON or null
  sortOrder: number;
}

/** 预置成就列表 */
export const SEED_ACHIEVEMENTS: SeedAchievement[] = [
  {
    key: "first_step",
    title: "初出茅庐",
    description: "完成第一个任务",
    icon: "⚔️",
    isHidden: false,
  },
  {
    key: "habit_5",
    title: "小有所成",
    description: "任意习惯连续坚持 5 天",
    icon: "🌱",
    isHidden: true,
  },
  {
    key: "habit_10",
    title: "持之以恒",
    description: "任意习惯连续坚持 10 天",
    icon: "🔥",
    isHidden: true,
  },
  {
    key: "habit_30",
    title: "钢铁意志",
    description: "任意习惯连续坚持 30 天",
    icon: "⚡",
    isHidden: true,
  },
  {
    key: "habit_66",
    title: "新生之我",
    description: "任意习惯连续坚持 66 天（传说中习惯养成的天数）",
    icon: "🌟",
    isHidden: true,
  },
  {
    key: "habit_100",
    title: "百折不挠",
    description: "任意习惯连续坚持 100 天",
    icon: "💎",
    isHidden: true,
  },
  {
    key: "global_7",
    title: "一周之星",
    description: "连续 7 天有任务完成记录",
    icon: "📅",
    isHidden: false,
  },
  {
    key: "global_30",
    title: "月度传说",
    description: "连续 30 天有任务完成记录",
    icon: "🏆",
    isHidden: true,
  },
  {
    key: "global_100",
    title: "百日英雄",
    description: "累计 100 天有任务完成记录",
    icon: "👑",
    isHidden: true,
  },
  {
    key: "level_5",
    title: "初级冒险者",
    description: "升至第 5 级",
    icon: "🛡️",
    isHidden: false,
  },
  {
    key: "level_10",
    title: "英雄降临",
    description: "升至第 10 级",
    icon: "🗡️",
    isHidden: true,
  },
  {
    key: "level_25",
    title: "传奇勇者",
    description: "升至第 25 级",
    icon: "🏰",
    isHidden: true,
  },
  {
    key: "level_50",
    title: "超越诸神",
    description: "升至第 50 级",
    icon: "🐉",
    isHidden: true,
  },
  {
    key: "gold_100",
    title: "腰缠万贯",
    description: "累计获得 100 枚金币",
    icon: "💰",
    isHidden: false,
  },
  {
    key: "gold_1000",
    title: "富可敌国",
    description: "累计获得 1000 枚金币",
    icon: "💎",
    isHidden: true,
  },
  {
    key: "task_50",
    title: "勤劳的勇者",
    description: "累计完成 50 个任务",
    icon: "📋",
    isHidden: false,
  },
  {
    key: "task_500",
    title: "任务收割机",
    description: "累计完成 500 个任务",
    icon: "⚙️",
    isHidden: true,
  },
  {
    key: "streak_best_14",
    title: "双周不败",
    description: "历史最佳连续打卡达到 14 天",
    icon: "🔥",
    isHidden: false,
  },
];

/** 预置主线剧情事件 */
export const SEED_STORY_EVENTS: SeedStoryEvent[] = [
  {
    chapterKey: "chapter_0_welcome",
    triggerCondition: JSON.stringify({ type: "first_login" }),
    title: "序幕：冒险的开始",
    dialogue:
      "欢迎你，年轻的勇者！\n\n这片大陆被「怠惰之雾」所笼罩，人们渐渐失去了行动的力量。而你，是被选中的那一位——拥有将日常点滴化为力量的潜质。\n\n我是引导者「艾尔德」，将陪伴你走过这段旅程。\n\n首先，去「习惯工坊」创造你的第一个习惯吧。记住：每一个微小的坚持，都是对抗怠惰的利刃。",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 10, gold: 5 }),
    sortOrder: 0,
  },
  {
    chapterKey: "chapter_1_awakening",
    triggerCondition: JSON.stringify({ type: "task_count", count: 5 }),
    title: "第一章：觉醒之力",
    dialogue:
      "干得好！你已经完成了 5 个任务。我能感受到你体内「坚持之力」的觉醒。\n\n从现在起，你的每一次完成都会为你带来经验值和金币。积攒足够的经验值就能升级，解锁更强的力量。\n\n继续前进吧，勇者！",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 30, gold: 15 }),
    sortOrder: 1,
  },
  {
    chapterKey: "chapter_2_trials",
    triggerCondition: JSON.stringify({ type: "level_reach", level: 3 }),
    title: "第二章：试炼之路",
    dialogue:
      "你已经升到了第 3 级！\n\n不过，真正的试炼才刚刚开始。前方的道路会更加艰难，但也更加精彩。\n\n看到那个「成就殿堂」了吗？那里记录着勇者们的辉煌。去挑战你的第一个隐藏成就吧——让一个习惯连续坚持 5 天。",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 50, gold: 25 }),
    sortOrder: 2,
  },
  {
    chapterKey: "chapter_3_mastery",
    triggerCondition: JSON.stringify({ type: "habit_streak_any", days: 10 }),
    title: "第三章：习惯大师",
    dialogue:
      "……难以置信。\n\n你竟然真的把一个习惯坚持了 10 天。你知道这意味着什么吗？你已经超越了 90% 的「普通人」。\n\n不，你已经不再普通了。从今天起，请允许我称呼你为——「习惯大师」。\n\n但这只是开始。真正的传奇，需要时间的淬炼。",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 100, gold: 50 }),
    sortOrder: 3,
  },
  {
    chapterKey: "chapter_4_guardian",
    triggerCondition: JSON.stringify({ type: "global_streak", days: 30 }),
    title: "第四章：守护者之誓",
    dialogue:
      "三十天……整整三十天，你没有一天懈怠。\n\n「怠惰之雾」在你面前已经退散了一大片。周围的村民们也因为你的影响，开始重新振作。\n\n你不仅是勇者，你已经成为了一位「守护者」。你的存在本身，就是力量的证明。",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 200, gold: 100 }),
    sortOrder: 4,
  },
  {
    chapterKey: "chapter_5_legend",
    triggerCondition: JSON.stringify({ type: "level_reach", level: 10 }),
    title: "终章：传奇之始",
    dialogue:
      "第 10 级……你已经成为了王国中极少数的强者。\n\n但是我想告诉你的不是恭维，而是一个真相：\n\n在远方，我还看到了更大的迷雾。这片大陆的边际还远未到达。等级没有上限，习惯没有终点。\n\n你准备好了吗，勇者？真正的传奇，从此刻才开始书写。",
    npcName: "引导者·艾尔德",
    reward: JSON.stringify({ xp: 300, gold: 200 }),
    sortOrder: 5,
  },
];
