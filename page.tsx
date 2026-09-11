'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardCheck,
  FileSearch,
  FlaskConical,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { analyzeWithDeepSeek, testDeepSeekKey, type DeepSeekTheme } from '@/lib/deepseek';

type Review = {
  review_id: string;
  rating: number;
  review_title: string;
  review_text: string;
};
type Profile = {
  name: string;
  category: string;
  brand: string;
  capacity: string;
  material: string;
  structure: string;
  verifiedPerformance: string;
  confirmedBenefits: string;
  currentListing: string;
  customFacts: { label: string; value: string }[];
};
type TagKey =
  | 'leak'
  | 'clean'
  | 'temperature'
  | 'weight'
  | 'appearance'
  | 'durability'
  | 'odor'
  | 'portable'
  | 'other';
type Classification =
  | '产品问题'
  | 'Listing 信息问题'
  | '用户预期问题'
  | '信息不足';
type ActionStatus =
  | '待确认'
  | '已确认'
  | '已采用行动'
  | '暂不处理'
  | '待产品验证';
type Priority = '高' | '中' | '低';
type TaggedReview = Review & { positive: TagKey[]; negative: TagKey[] };
type Insight = {
  id: string;
  tag: TagKey;
  sentiment: '痛点' | '满意点';
  title: string;
  need: string;
  classification: Classification[];
  productMatch: string;
  action: string;
  reviewIds: string[];
  confirmed: boolean;
  status: ActionStatus;
  listingAdopted: boolean;
  priority: Priority;
  priorityReason: string;
  severity: string;
  scenario: string;
  listingCoverage: string;
  manualRoute?: 'Listing' | '产品待确认' | '暂不处理';
  aiListingCopy?: string;
  aiListingPosition?: string;
  aiMatchedFact?: string;
};

const TAGS: Record<TagKey, string> = {
  leak: '杯盖漏水',
  clean: '清洁便利性',
  temperature: '保温表现',
  weight: '重量',
  appearance: '外观',
  durability: '耐用性',
  odor: '异味',
  portable: '携带便利性',
  other: '待人工归类反馈',
};
const SAMPLE_REVIEWS: Review[] = [
  {
    review_id: 'R-001',
    rating: 2,
    review_title: 'Leaks in my bag',
    review_text:
      'The lid leaked in my work bag after a week. I need a bottle I can trust on my commute.',
  },
  {
    review_id: 'R-002',
    rating: 5,
    review_title: 'Cold all day',
    review_text:
      'Ice was still inside after my workday. Great temperature retention and looks beautiful.',
  },
  {
    review_id: 'R-003',
    rating: 3,
    review_title: 'Hard to clean',
    review_text:
      'The lid has small grooves that are hard to clean. I wish it came apart more easily.',
  },
  {
    review_id: 'R-004',
    rating: 2,
    review_title: 'Another leak',
    review_text:
      'It leaks around the lid when placed sideways. Not reliable for commuting.',
  },
  {
    review_id: 'R-005',
    rating: 5,
    review_title: 'Love the finish',
    review_text:
      'Beautiful color, feels durable, and keeps water cold for hours.',
  },
  {
    review_id: 'R-006',
    rating: 3,
    review_title: 'A little heavy',
    review_text: 'It is sturdy but heavier than expected when full.',
  },
  {
    review_id: 'R-007',
    rating: 4,
    review_title: 'Easy to carry',
    review_text: 'Fits my cup holder and is convenient to carry to the gym.',
  },
  {
    review_id: 'R-008',
    rating: 1,
    review_title: 'Strange smell',
    review_text: 'The bottle had a plastic smell even after washing it twice.',
  },
  {
    review_id: 'R-009',
    rating: 2,
    review_title: 'Cleaning takes time',
    review_text: 'Cleaning the lid is difficult and water stays in the seal.',
  },
  {
    review_id: 'R-010',
    rating: 5,
    review_title: 'Reliable insulation',
    review_text:
      'Keeps drinks cold through a long office day. The design is sleek.',
  },
  {
    review_id: 'R-011',
    rating: 4,
    review_title: 'Solid bottle',
    review_text: 'Feels durable and the handle makes it easy to carry.',
  },
  {
    review_id: 'R-012',
    rating: 1,
    review_title: 'Wet backpack',
    review_text:
      'The cap leaked and soaked my backpack. I cannot use it for travel.',
  },
];
const defaultProfile: Profile = {
  name: 'TrailSip 真空保温杯',
  category: '保温杯 / Water Bottle',
  brand: 'TrailSip',
  capacity: '750 ml',
  material: '304 不锈钢杯身；杯盖材质待确认',
  structure: '杯盖与密封圈可手动拆卸清洗',
  verifiedPerformance: '内部测试：常温环境下保冷 12 小时',
  confirmedBenefits: '杯盖可拆卸；适配标准汽车杯架',
  currentListing:
    'Durable stainless steel bottle for everyday use. Convenient handle and modern finish.',
  customFacts: [{ label: '密封测试', value: '尚未完成，不能宣称 leak-proof' }],
};
const ALL_CLASSES: Classification[] = [
  '产品问题',
  'Listing 信息问题',
  '用户预期问题',
  '信息不足',
];
const ALL_STATUSES: ActionStatus[] = [
  '待确认',
  '已确认',
  '已采用行动',
  '暂不处理',
  '待产品验证',
];
const PRIORITY_ORDER: Record<Priority, number> = { 高: 0, 中: 1, 低: 2 };

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
function cleanReviews(rows: Review[]) {
  const ids = new Set<string>(),
    texts = new Set<string>(),
    valid: Review[] = [];
  let empty = 0,
    duplicate = 0;
  rows.forEach((row, index) => {
    const text = row.review_text?.trim() ?? '';
    if (!text) {
      empty++;
      return;
    }
    const id = row.review_id?.trim() || `generated-${index + 1}`,
      normalized = normalizeText(text);
    if (ids.has(id) || texts.has(normalized)) {
      duplicate++;
      return;
    }
    ids.add(id);
    texts.add(normalized);
    valid.push({
      ...row,
      review_id: id,
      review_text: text,
      rating: Number(row.rating) || 0,
    });
  });
  return { raw: rows.length, valid, empty, duplicate };
}
function parseCsv(input: string): Review[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw new Error('CSV 文件为空');
  const headers = rows[0].map((item) => item.trim().replace(/^\uFEFF/, '')),
    required = ['review_id', 'rating', 'review_title', 'review_text'],
    missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`缺少字段：${missing.join('、')}`);
  return rows.slice(1).map((v) => ({
    review_id: v[headers.indexOf('review_id')] ?? '',
    rating: Number(v[headers.indexOf('rating')]) || 0,
    review_title: v[headers.indexOf('review_title')] ?? '',
    review_text: v[headers.indexOf('review_text')] ?? '',
  }));
}
function tagReview(review: Review): TaggedReview {
  const text = normalizeText(`${review.review_title} ${review.review_text}`),
    match = (words: string[]) => words.some((word) => text.includes(word)),
    detected: TagKey[] = [];
  if (match(['leak', 'wet', 'soaked'])) detected.push('leak');
  if (match(['clean', 'washing', 'groove', 'seal'])) detected.push('clean');
  if (match(['cold', 'temperature', 'insulation', 'ice']))
    detected.push('temperature');
  if (match(['heavy', 'weight'])) detected.push('weight');
  if (match(['beautiful', 'color', 'sleek', 'finish', 'looks']))
    detected.push('appearance');
  if (match(['durable', 'sturdy', 'solid'])) detected.push('durability');
  if (match(['smell', 'odor'])) detected.push('odor');
  if (match(['carry', 'commute', 'travel', 'cup holder', 'gym']))
    detected.push('portable');
  if (!detected.length) detected.push('other');
  return {
    ...review,
    positive: review.rating >= 4 ? detected : [],
    negative: review.rating <= 3 ? detected : [],
  };
}
function buildInsights(
  tagged: TaggedReview[],
  profile: Profile,
  includeAllRecognized = false,
): Insight[] {
  const configs: Record<
    TagKey,
    {
      need: string;
      classes: Classification[];
      match: string;
      action: string;
      priority: Priority;
      severity: string;
      scenario: string;
      coverage: string;
    }
  > = {
    leak: {
      need: '密封可靠，随身携带时不渗漏',
      classes: ['产品问题', '用户预期问题'],
      match: '未知：产品档案明确显示密封测试尚未完成',
      action: '先完成密封性能验证；不得把竞品痛点直接转化为防漏宣称。',
      priority: '高',
      severity: '高：影响可靠性感知，可能造成退货',
      scenario: '通勤、横放、背包携带',
      coverage: '当前 Listing 未覆盖密封能力，且产品事实尚未验证',
    },
    clean: {
      need: '杯盖容易拆卸和彻底清洁',
      classes: ['产品问题', 'Listing 信息问题'],
      match: profile.structure.includes('可')
        ? '已匹配：档案确认杯盖与密封圈可拆卸'
        : '信息不足 / 待人工确认',
      action:
        '人工确认实际拆洗流程；若属实，可在 Listing 中补充拆卸和清洁说明。',
      priority: '高',
      severity: '中：持续影响日常使用体验',
      scenario: '日常饮用后的拆洗与维护',
      coverage: '当前 Listing 未说明拆卸与清洁方式',
    },
    temperature: {
      need: '长时间保持饮品低温',
      classes: ['Listing 信息问题'],
      match: profile.verifiedPerformance
        ? '已匹配：档案包含 12 小时保冷测试'
        : '信息不足 / 待人工确认',
      action: '可基于已验证的 12 小时测试优化保冷表达，不得扩写为 24 小时。',
      priority: '中',
      severity: '中：影响核心性能认知',
      scenario: '办公室、长时间日常使用',
      coverage: '当前 Listing 仅有笼统描述，未写明已验证时长',
    },
    weight: {
      need: '满杯时仍便于日常携带',
      classes: ['产品问题', '用户预期问题'],
      match: '信息不足：档案未记录产品重量',
      action: '补充产品净重与满杯重量，并检查 Listing 是否清楚说明。',
      priority: '中',
      severity: '中：影响携带体验',
      scenario: '满杯通勤与外出携带',
      coverage: '当前 Listing 未提供重量信息',
    },
    appearance: {
      need: '日常使用中兼顾外观质感',
      classes: ['Listing 信息问题'],
      match: '部分匹配：缺少颜色事实',
      action: '保留已确认的外观表达，不新增未经确认的颜色信息。',
      priority: '低',
      severity: '低：属于偏好型反馈',
      scenario: '日常外观与颜色偏好',
      coverage: '当前 Listing 已包含 modern finish，暂无重复修改必要',
    },
    durability: {
      need: '经得住日常反复使用',
      classes: ['信息不足'],
      match: '信息不足：材质不能直接等同耐用测试',
      action: '若要强化耐用性宣称，应先补充测试依据。',
      priority: '低',
      severity: '低：当前反馈未显示明确失效',
      scenario: '日常反复使用',
      coverage: '当前 Listing 已使用 durable，但缺少测试依据',
    },
    odor: {
      need: '饮水接触部件无持续异味',
      classes: ['产品问题'],
      match: '信息不足：杯盖材质与气味测试待确认',
      action: '核实杯盖材质并进行清洗后的气味检查。',
      priority: '中',
      severity: '中：影响饮用体验与材质感知',
      scenario: '首次使用与清洗后饮用',
      coverage: '当前 Listing 未覆盖气味或杯盖材质',
    },
    portable: {
      need: '通勤、健身和驾车时方便携带',
      classes: ['Listing 信息问题'],
      match: '已匹配：档案确认适配标准汽车杯架',
      action: '可强化杯架适配场景；其他场景仍需确认。',
      priority: '中',
      severity: '中：影响高频携带场景',
      scenario: '通勤、健身、驾车',
      coverage: '当前 Listing 有 handle，但未明确杯架适配',
    },
    other: {
      need: '进一步理解未归类反馈',
      classes: ['信息不足'],
      match: '信息不足 / 待人工确认',
      action: '查看原始评论后再决定是否建立新标签。',
      priority: '低',
      severity: '低：信息不足',
      scenario: '未知',
      coverage: '无法判断',
    },
  };
  const make = (tag: TagKey, sentiment: '痛点' | '满意点'): Insight | null => {
    const reviewIds = tagged
      .filter((r) =>
        (sentiment === '痛点' ? r.negative : r.positive).includes(tag),
      )
      .map((r) => r.review_id);
    if (!reviewIds.length) return null;
    const c = configs[tag];
    const percentage = ((reviewIds.length / tagged.length) * 100).toFixed(1);
    const priorityReason =
      tag === 'leak'
        ? `高优先级：${percentage}% 评论提到漏水，集中在通勤和背包携带等核心场景，可能直接影响可靠性感知；密封性能尚未验证，应先确认产品能力。`
        : tag === 'clean'
          ? `高优先级：${percentage}% 评论涉及清洁困难，属于高频日常使用阻力；产品档案确认可拆卸，而当前 Listing 未说明，具备明确回应空间。`
          : tag === 'appearance'
            ? `低优先级：${percentage}% 评论为正向外观偏好，未形成购买或使用障碍，且当前 Listing 已有外观描述，建议后续观察。`
            : `${c.priority}优先级：${percentage}% 评论涉及该需求；结合${c.scenario}的重要性、产品事实匹配和当前 Listing 覆盖情况，建议按${c.priority}优先级处理。`;
    return {
      id: `${sentiment}-${tag}`,
      tag,
      sentiment,
      title: TAGS[tag],
      need: c.need,
      classification: c.classes,
      productMatch: c.match,
      action: c.action,
      reviewIds,
      confirmed: false,
      status: '待确认',
      listingAdopted: false,
      priority: c.priority,
      priorityReason,
      severity: c.severity,
      scenario: c.scenario,
      listingCoverage: c.coverage,
    };
  };
  const all = (Object.keys(TAGS) as TagKey[]).filter((tag) => tag !== 'other');
  const negative = all
      .map((tag) => make(tag, '痛点'))
      .filter(Boolean) as Insight[],
    positive = all
      .map((tag) => make(tag, '满意点'))
      .filter(Boolean) as Insight[];
  const unknownReviewIds = [
    ...new Set(
      tagged
        .filter(
          (review) =>
            review.negative.includes('other') ||
            review.positive.includes('other'),
        )
        .map((review) => review.review_id),
    ),
  ];
  const unknownInsight: Insight | null = unknownReviewIds.length
    ? {
        id: 'manual-other',
        tag: 'other',
        sentiment: '痛点',
        title: '待人工归类反馈',
        need: '待人工填写',
        classification: ['信息不足'],
        productMatch: '待人工判断：系统未对陌生反馈推断产品能力',
        action: '查看原始 Evidence，并通过“修改判断”补充洞察后再选择处理路径。',
        reviewIds: unknownReviewIds,
        confirmed: false,
        status: '待确认',
        listingAdopted: false,
        priority: '低',
        priorityReason: `未自动归类：${unknownReviewIds.length} 条评论缺少可靠规则，不根据零散词语生成伪洞察。`,
        severity: '待人工判断',
        scenario: '待人工填写',
        listingCoverage: '待人工判断',
      }
    : null;
  const sortedNegative = negative.sort(
    (a, b) => b.reviewIds.length - a.reviewIds.length,
  );
  const sortedPositive = positive.sort(
    (a, b) => b.reviewIds.length - a.reviewIds.length,
  );
  return [
    ...(includeAllRecognized ? sortedNegative : sortedNegative.slice(0, 3)),
    ...(includeAllRecognized ? sortedPositive : sortedPositive.slice(0, 2)),
    ...(unknownInsight ? [unknownInsight] : []),
  ].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.reviewIds.length - a.reviewIds.length,
  );
}

function getListingSuggestion(insight: Insight, profile: Profile) {
  if (insight.aiListingCopy && insight.aiMatchedFact) return insight.aiListingCopy;
  if (
    insight.tag === 'clean' &&
    profile.structure.includes('可') &&
    profile.structure.includes('拆卸')
  )
    return 'Removable lid and seal for straightforward, thorough cleaning after daily use.';
  if (
    insight.tag === 'temperature' &&
    profile.verifiedPerformance.includes('12')
  )
    return 'Tested to keep drinks cold for up to 12 hours under normal room conditions.';
  if (insight.tag === 'portable' && profile.confirmedBenefits.includes('杯架'))
    return 'Fits standard car cup holders, with a convenient handle for everyday carry.';
  return '';
}

function listingBulletIndex(insight: Insight) {
  if (insight.aiListingPosition) {
    const match = insight.aiListingPosition.match(/Bullet Point\s+(\d)/i);
    if (match) return Number(match[1]) - 1;
  }
  if (insight.tag === 'temperature') return 1;
  if (insight.tag === 'clean') return 2;
  if (insight.tag === 'portable') return 3;
  return -1;
}

function listingPlacement(insight: Insight) {
  if (insight.aiListingPosition)
    return insight.aiListingPosition;
  const index = listingBulletIndex(insight);
  if (index < 0) return '不建议修改 Listing';
  const image = imageSuggestion(insight);
  return `Bullet Point ${index + 1}${image ? ' + Product Image / Infographic' : ''}`;
}

function placementReason(insight: Insight) {
  if (insight.tag === 'clean')
    return '清洁方式需要文字说明，同时用结构图展示杯盖与密封圈拆卸关系更直观。';
  if (insight.tag === 'temperature')
    return '保冷时长是核心性能信息，适合放在靠前 Bullet 中快速传达，且已有测试事实支持。';
  if (insight.tag === 'portable')
    return '杯架适配适合在 Bullet 中说明，并通过场景图帮助用户快速理解尺寸与使用方式。';
  return '当前信息优先级较低、已有覆盖或缺少事实支持，不建议修改。';
}

function imageSuggestion(insight: Insight) {
  if (insight.tag === 'clean')
    return '增加杯盖拆卸结构图，展示杯盖与密封圈可拆卸，并配合简短清洁步骤。';
  if (insight.tag === 'portable')
    return '增加汽车杯架使用场景图，标注适配标准杯架；不延伸到未验证的其他尺寸。';
  return '';
}

function factEvidence(insight: Insight, profile: Profile) {
  if (insight.aiMatchedFact) return insight.aiMatchedFact;
  if (insight.tag === 'clean') return profile.structure;
  if (insight.tag === 'temperature') return profile.verifiedPerformance;
  if (insight.tag === 'portable') return profile.confirmedBenefits;
  return '当前产品档案没有足够事实支持具体宣称';
}

function currentPlacementCopy(insight: Insight, profile: Profile) {
  const originalBullets = [
    profile.currentListing,
    'Reliable everyday hydration for work, travel, and daily routines.',
    'Stainless steel construction with a modern finish.',
    'Convenient handle for everyday carry.',
    'Designed for straightforward daily use and care.',
  ];
  const index = listingBulletIndex(insight);
  if (index >= 0) return `Bullet Point ${index + 1}：${originalBullets[index]}`;
  return profile.currentListing;
}

function productRequest(insight: Insight, frequency: string) {
  const isLeak = insight.tag === 'leak';
  return {
    background: `${frequency}提到${insight.title}，主要发生在${insight.scenario}场景。`,
    why: isLeak
      ? '运营无法从竞品评论判断自家产品是否防漏，且产品档案明确显示密封测试尚未完成。'
      : `现有产品资料不足以支持对${insight.title}作确定性判断，需要产品或供应链补充事实。`,
    questions: isLeak
      ? [
          '当前产品是否做过密封或横放测试？',
          '测试条件、时长和样品数量是什么？',
          '是否存在可公开使用的准确结论？',
          '杯盖结构是否有明确使用限制？',
        ]
      : [
          `当前产品是否验证过与“${insight.title}”相关的性能？`,
          '验证条件和结果是什么？',
          '是否有可公开表述的产品事实或限制？',
        ],
    returns: [
      '已验证产品事实',
      '测试条件与结果',
      '可公开使用的准确表述',
      '使用限制或结构说明',
    ],
    next: isLeak
      ? '资料确认后再判断是否强化密封卖点；确认前不使用 leak-proof 等宣称。'
      : insight.action,
  };
}

function collaborationTitle(insight: Insight) {
  if (insight.tag === 'leak') return '产品协作需求｜密封性能确认';
  return `产品协作需求｜${insight.title}确认`;
}

function finalDecision(insight: Insight) {
  if (insight.listingAdopted) return 'Listing 修改已采用';
  if (insight.status === '待产品验证') return '待产品测试与事实确认';
  return insight.status;
}

function decisionCta(insight: Insight, profile: Profile) {
  if (insight.aiListingCopy && insight.aiMatchedFact)
    return {
      label: '生成 Listing 建议',
      outcome: '已确认' as ActionStatus,
      openListing: true,
    };
  if (insight.tag === 'other') {
    if (insight.manualRoute === '产品待确认')
      return {
        label: '加入产品待确认',
        outcome: '待产品验证' as ActionStatus,
        openListing: false,
      };
    if (insight.manualRoute === '暂不处理')
      return {
        label: '确认暂不处理',
        outcome: '暂不处理' as ActionStatus,
        openListing: false,
      };
    if (insight.manualRoute === 'Listing')
      return {
        label: '确认进入 Listing 路径',
        outcome: '已确认' as ActionStatus,
        openListing: false,
      };
    return {
      label: '填写人工判断',
      outcome: '待确认' as ActionStatus,
      openListing: false,
    };
  }
  const hasListingOpportunity = Boolean(getListingSuggestion(insight, profile));
  if (
    insight.tag === 'leak' ||
    (!hasListingOpportunity && insight.classification.includes('产品问题'))
  )
    return {
      label: '生成产品协作需求',
      outcome: '待产品验证' as ActionStatus,
      openListing: false,
    };
  if (insight.priority === '低' || insight.listingCoverage.includes('已有覆盖'))
    return {
      label: '保持现状',
      outcome: '暂不处理' as ActionStatus,
      openListing: false,
    };
  if (hasListingOpportunity)
    return {
      label: '生成 Listing 建议',
      outcome: '已确认' as ActionStatus,
      openListing: true,
    };
  return {
    label: '确认判断',
    outcome: '已确认' as ActionStatus,
    openListing: false,
  };
}

function themesToInsights(themes: DeepSeekTheme[]): Insight[] {
  return themes.map((theme, index) => ({
    id: `ai-${theme.key}-${index}`,
    tag: 'other' as TagKey,
    sentiment: theme.sentiment,
    title: theme.title,
    need: theme.userNeed,
    classification: theme.classification,
    productMatch: theme.productMatch,
    action: theme.recommendedAction,
    reviewIds: theme.reviewIds,
    confirmed: false,
    status: '待确认' as ActionStatus,
    listingAdopted: false,
    priority: theme.priority,
    priorityReason: theme.priorityReason,
    severity: theme.severity,
    scenario: theme.scenario,
    listingCoverage: theme.listingCoverage,
    manualRoute:
      theme.route === 'Listing' || theme.route === '产品待确认' || theme.route === '暂不处理'
        ? theme.route
        : undefined,
    aiListingCopy:
      theme.route === 'Listing' && theme.matchedFact && theme.listingCopy
        ? theme.listingCopy
        : undefined,
    aiListingPosition: theme.listingPosition || undefined,
    aiMatchedFact: theme.matchedFact || undefined,
  })).sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.reviewIds.length - a.reviewIds.length,
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(defaultProfile),
    [editingProfile, setEditingProfile] = useState(false),
    [saved, setSaved] = useState(false),
    [sourceRows, setSourceRows] = useState<Review[]>([]),
    [fileName, setFileName] = useState(''),
    [csvError, setCsvError] = useState(''),
    [step, setStep] = useState(0),
    [insights, setInsights] = useState<Insight[]>([]),
    [expandedEvidence, setExpandedEvidence] = useState<string | null>(null),
    [listingInsightId, setListingInsightId] = useState<string | null>(null),
    [copiedKey, setCopiedKey] = useState<string | null>(null),
    [showAllInsights, setShowAllInsights] = useState(false),
    [editingJudgmentId, setEditingJudgmentId] = useState<string | null>(null),
    [deepSeekKey, setDeepSeekKey] = useState(''),
    [showDeepSeekSettings, setShowDeepSeekSettings] = useState(false),
    [deepSeekStatus, setDeepSeekStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle'),
    [deepSeekMessage, setDeepSeekMessage] = useState(''),
    [isAnalyzing, setIsAnalyzing] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(
      'crossborder-product-profile-v1',
    );
    if (stored)
      try {
        const parsed = JSON.parse(stored);
        setTimeout(() => setProfile(parsed), 0);
      } catch {}
    const storedKey = window.localStorage.getItem('crossborder-deepseek-key-v1');
    if (storedKey) {
      setTimeout(() => {
        setDeepSeekKey(storedKey);
        setDeepSeekStatus('connected');
      }, 0);
    }
  }, []);
  const cleaned = cleanReviews(sourceRows),
    tagged = cleaned.valid.map(tagReview);
  const saveProfile = () => {
    window.localStorage.setItem(
      'crossborder-product-profile-v1',
      JSON.stringify(profile),
    );
    setEditingProfile(false);
    if (insights.length) {
      setInsights([]);
      setStep(sourceRows.length ? 1 : 0);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  const loadSample = () => {
    setSourceRows([
      ...SAMPLE_REVIEWS,
      { ...SAMPLE_REVIEWS[2] },
      {
        review_id: 'R-empty',
        rating: 4,
        review_title: 'Blank',
        review_text: '',
      },
    ]);
    setFileName('sample-insulated-bottle-reviews.csv');
    setCsvError('');
    setStep(1);
    setInsights([]);
    setListingInsightId(null);
  };
  const uploadCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSourceRows(parseCsv(await file.text()));
      setFileName(file.name);
      setCsvError('');
      setStep(1);
      setInsights([]);
      setListingInsightId(null);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : '无法读取 CSV');
      setSourceRows([]);
      setStep(0);
    }
    event.target.value = '';
  };
  const isSample = fileName === 'sample-insulated-bottle-reviews.csv';
  const runAnalysis = async () => {
      if (isSample) {
        setInsights(buildInsights(tagged, profile));
        setStep(6);
        return;
      }
      if (!deepSeekKey) {
        setShowDeepSeekSettings(true);
        setDeepSeekMessage('分析陌生 CSV 前，请先连接 DeepSeek API。');
        return;
      }
      setIsAnalyzing(true);
      setCsvError('');
      try {
        const themes = await analyzeWithDeepSeek(deepSeekKey, profile, cleaned.valid);
        if (!themes.length) throw new Error('未生成可处理的洞察，请检查评论内容');
        setInsights(themesToInsights(themes));
        setStep(6);
      } catch (error) {
        setCsvError(error instanceof Error ? error.message : 'DeepSeek 分析失败');
      } finally {
        setIsAnalyzing(false);
      }
    },
    connectDeepSeek = async () => {
      if (!deepSeekKey.trim()) {
        setDeepSeekStatus('error');
        setDeepSeekMessage('请输入 API Key');
        return;
      }
      setDeepSeekStatus('testing');
      setDeepSeekMessage('正在测试连接…');
      try {
        await testDeepSeekKey(deepSeekKey);
        window.localStorage.setItem('crossborder-deepseek-key-v1', deepSeekKey.trim());
        setDeepSeekKey(deepSeekKey.trim());
        setDeepSeekStatus('connected');
        setDeepSeekMessage('连接成功，密钥已保存在此设备的浏览器中。');
      } catch (error) {
        setDeepSeekStatus('error');
        setDeepSeekMessage(error instanceof Error ? error.message : '连接失败');
      }
    },
    disconnectDeepSeek = () => {
      window.localStorage.removeItem('crossborder-deepseek-key-v1');
      setDeepSeekKey('');
      setDeepSeekStatus('idle');
      setDeepSeekMessage('已从此设备删除 API Key。');
    },
    updateInsight = (id: string, patch: Partial<Insight>) =>
      setInsights((a) => a.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    removeInsight = (id: string) =>
      setInsights((a) => a.filter((i) => i.id !== id)),
    toggleClass = (id: string, value: Classification) =>
      setInsights((a) =>
        a.map((i) =>
          i.id === id
            ? {
                ...i,
                classification: i.classification.includes(value)
                  ? i.classification.filter((c) => c !== value)
                  : [...i.classification, value],
              }
            : i,
        ),
      );
  const selectedInsight = insights.find((i) => i.id === listingInsightId),
    listingAfter = selectedInsight
      ? getListingSuggestion(selectedInsight, profile)
      : '',
    claimStatus = listingAfter ? 'Supported' : 'Needs human confirmation';
  const confirmedInsights = insights.filter((i) => i.status !== '待确认'),
    adoptedListings = confirmedInsights.filter((i) => i.listingAdopted),
    productTodos = confirmedInsights.filter((i) => i.status === '待产品验证'),
    deferredItems = confirmedInsights.filter(
      (i) => i.status === '暂不处理' || i.classification.includes('信息不足'),
    ),
    pendingInsights = insights.filter((i) => i.status === '待确认'),
    visibleInsights = showAllInsights
      ? insights
      : pendingInsights.length
        ? [pendingInsights[0]]
        : [];
  const frequencyText = (insight: Insight) => {
    const count = insight.reviewIds.length;
    const percentage = cleaned.valid.length
      ? ((count / cleaned.valid.length) * 100).toFixed(1)
      : '0.0';
    return `${count} 条（${percentage}%）`;
  };
  const listingDraft = (() => {
    const bullets = [
      profile.currentListing,
      'Reliable everyday hydration for work, travel, and daily routines.',
      'Stainless steel construction with a modern finish.',
      'Convenient handle for everyday carry.',
      'Designed for straightforward daily use and care.',
    ];
    const candidates = new Map<number, string[]>();
    adoptedListings.forEach((insight) => {
      const index = listingBulletIndex(insight);
      if (index < 0) return;
      candidates.set(index, [
        ...(candidates.get(index) ?? []),
        getListingSuggestion(insight, profile),
      ]);
    });
    candidates.forEach((suggestions, index) => {
      bullets[index] =
        suggestions.length === 1
          ? suggestions[0]
          : `⚠ 同一位置存在 ${suggestions.length} 个候选，请人工合并：${suggestions.join(' / ')}`;
    });
    return {
      title: `${profile.name.toLowerCase().startsWith(profile.brand.toLowerCase()) ? profile.name : `${profile.brand} ${profile.name}`} ${profile.capacity}`,
      bullets,
      description: profile.currentListing,
      images: adoptedListings.map(imageSuggestion).filter(Boolean),
    };
  })();
  const listingAudit = (() => {
    const routedPositions = adoptedListings.map(
      (insight) => listingPlacement(insight).split(' + ')[0],
    );
    const noRouteConflict =
      new Set(routedPositions).size === routedPositions.length;
    const factsSupported = adoptedListings.every((insight) =>
      Boolean(getListingSuggestion(insight, profile)),
    );
    return { noRouteConflict, factsSupported };
  })();
  const fullListingText = () =>
    [
      `Title\n${listingDraft.title}`,
      ...listingDraft.bullets.map(
        (bullet, index) => `Bullet Point ${index + 1}\n${bullet}`,
      ),
      `Description / A+\n${listingDraft.description}`,
      listingDraft.images.length
        ? `图片内容建议\n${listingDraft.images.map((item) => `- ${item}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  const actionPlanText = () => {
    const lines = [
      '# 本次运营行动方案',
      '',
      '## 本次分析摘要',
      `- 有效评论：${cleaned.valid.length} 条`,
      `- 已确认核心洞察：${confirmedInsights.length} 项${confirmedInsights.length ? `（${confirmedInsights.map((i) => i.title).join('、')}）` : ''}`,
      '',
      '## 核心洞察',
    ];
    confirmedInsights.forEach((insight) => {
      lines.push(
        `### ${insight.title}`,
        `- 运营优先级：${insight.priority}（${insight.priorityReason}）`,
        `- 频次/占比：${frequencyText(insight)}`,
        `- 用户需求：${insight.need}`,
        `- 核心场景：${insight.scenario}`,
        `- 产品匹配：${insight.productMatch}`,
        `- 当前 Listing 覆盖：${insight.listingCoverage}`,
        `- 最终决定：${finalDecision(insight)}`,
        '',
      );
    });
    lines.push('## A. 最终 Listing 草稿');
    if (!adoptedListings.length) lines.push('- 暂无已采用的 Listing 修改建议');
    if (adoptedListings.length) {
      lines.push('', fullListingText(), '', '### 修改来源与依据');
      adoptedListings.forEach((insight) =>
        lines.push(
          `- ${listingPlacement(insight)}｜来源：${insight.title}｜Claim Check：Supported｜事实依据：${factEvidence(insight, profile)}`,
        ),
      );
    }
    lines.push('', '## B. 产品 / 供应链待办');
    if (!productTodos.length) lines.push('- 暂无');
    productTodos.forEach((insight) => {
      const card = productRequest(insight, frequencyText(insight));
      lines.push(
        `### ${collaborationTitle(insight)}（${insight.priority}优先级）`,
        '- 协作对象：产品 / 供应链',
        '- 当前状态：待确认',
        `- 问题背景：${card.background}`,
        '- 原始 Evidence：',
        ...insight.reviewIds.map((id) => {
          const review = cleaned.valid.find((item) => item.review_id === id);
          return review
            ? `  - ${id}｜${review.review_title}：${review.review_text}`
            : `  - ${id}`;
        }),
        `- 为什么需要确认：${card.why}`,
        '- 需要确认的问题：',
        ...card.questions.map((question) => `  - ${question}`),
        `- 希望返回的信息：${card.returns.join('、')}`,
        `- 运营后续动作：${card.next}`,
        '- 闭环路径：待产品确认 → 产品返回事实 → 更新 Product Profile → 重新判断是否可以进入 Listing',
        '',
      );
    });
    lines.push('## C. 本轮运营复盘');
    lines.push(
      `- 评论数据：原始 ${cleaned.raw} 条，有效 ${cleaned.valid.length} 条`,
      `- 洞察优先级：高 ${insights.filter((i) => i.priority === '高').length}，中 ${insights.filter((i) => i.priority === '中').length}，低 ${insights.filter((i) => i.priority === '低').length}`,
      `- 本轮决定：Listing 修改 ${adoptedListings.length} 项，产品待确认 ${productTodos.length} 项，暂不处理 ${confirmedInsights.filter((i) => i.status === '暂不处理').length} 项`,
      `- 核心用户需求：${confirmedInsights.map((i) => i.need).join('；') || '待人工确认'}`,
      `- 已采取行动：${adoptedListings.map((i) => `${i.title}：${listingPlacement(i)}`).join('；') || '暂无'}`,
      `- 下一步：${productTodos.map((i) => `${i.title}：${i.action}`).join('；') || '暂无产品侧待办'}`,
      '',
      '### 暂不处理 / 信息不足事项',
    );
    if (!deferredItems.length) lines.push('- 暂无');
    deferredItems.forEach((insight) =>
      lines.push(
        `- ${insight.title}：${finalDecision(insight)}；${insight.action}`,
      ),
    );
    return lines.join('\n');
  };
  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      setCopiedKey(`error:${key}`);
    }
    window.setTimeout(
      () =>
        setCopiedKey((current) =>
          current === key || current === `error:${key}` ? null : current,
        ),
      1800,
    );
  };
  return (
    <main>
      <header className="topbar">
        <div className="brand-mark">
          <Sparkles size={20} />
        </div>
        <div>
          <h1>AI 跨境电商运营决策助手</h1>
          <p>AI Cross-border Ops Decision Assistant</p>
        </div>
        <button
          className={`api-status ${deepSeekStatus === 'connected' ? 'connected' : ''}`}
          onClick={() => setShowDeepSeekSettings(true)}
        >
          <KeyRound size={14} />
          {deepSeekStatus === 'connected' ? 'DeepSeek 已连接' : '连接 DeepSeek'}
        </button>
      </header>
      <div className="notice">
        <FlaskConical size={17} />
        <span>
          <strong>演示说明：</strong>历史数据仅用于 Workflow
          功能验证，不代表当前市场趋势。
        </span>
      </div>
      <div className="workspace">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 · 我的产品</span>
              <h2>自家产品档案</h2>
              <p>AI 只能读取，产品事实只能由你修改。</p>
            </div>
            <button
              className="button secondary"
              onClick={() => setEditingProfile(!editingProfile)}
            >
              <Pencil size={15} />
              {editingProfile ? '取消编辑' : '编辑档案'}
            </button>
          </div>
          {editingProfile ? (
            <div className="profile-form">
              {(
                [
                  ['name', '产品名称'],
                  ['category', '品类'],
                  ['brand', '品牌'],
                  ['capacity', '容量'],
                  ['material', '材质'],
                  ['structure', '结构'],
                  ['verifiedPerformance', '已验证性能'],
                  ['confirmedBenefits', '已确认卖点'],
                ] as [keyof Profile, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    value={profile[key] as string}
                    onChange={(e) =>
                      setProfile({ ...profile, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="full">
                <span>当前 Listing</span>
                <textarea
                  rows={3}
                  value={profile.currentListing}
                  onChange={(e) =>
                    setProfile({ ...profile, currentListing: e.target.value })
                  }
                />
              </label>
              <div className="full facts-edit">
                <span>自定义产品事实</span>
                {profile.customFacts.map((fact, i) => (
                  <div className="fact-row" key={i}>
                    <input
                      aria-label="事实名称"
                      value={fact.label}
                      onChange={(e) => {
                        const a = [...profile.customFacts];
                        a[i] = { ...fact, label: e.target.value };
                        setProfile({ ...profile, customFacts: a });
                      }}
                    />
                    <input
                      aria-label="事实内容"
                      value={fact.value}
                      onChange={(e) => {
                        const a = [...profile.customFacts];
                        a[i] = { ...fact, value: e.target.value };
                        setProfile({ ...profile, customFacts: a });
                      }}
                    />
                    <button
                      aria-label="删除事实"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          customFacts: profile.customFacts.filter(
                            (_, n) => n !== i,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() =>
                    setProfile({
                      ...profile,
                      customFacts: [
                        ...profile.customFacts,
                        { label: '', value: '' },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  添加事实
                </button>
              </div>
              <div className="full form-actions">
                <button className="button primary" onClick={saveProfile}>
                  <Save size={15} />
                  保存产品档案
                </button>
                {saved && (
                  <span className="saved">
                    <Check size={15} />
                    已保存到本地
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="profile-view">
              <div className="product-identity">
                <span className="product-icon">
                  <Archive size={22} />
                </span>
                <div>
                  <strong>{profile.name}</strong>
                  <span>
                    {profile.brand} · {profile.category} · {profile.capacity}
                  </span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>结构</dt>
                  <dd>{profile.structure || '信息不足 / 待人工确认'}</dd>
                </div>
                <div>
                  <dt>已验证性能</dt>
                  <dd>
                    {profile.verifiedPerformance || '信息不足 / 待人工确认'}
                  </dd>
                </div>
                <div>
                  <dt>已确认卖点</dt>
                  <dd>
                    {profile.confirmedBenefits || '信息不足 / 待人工确认'}
                  </dd>
                </div>
                <div>
                  <dt>关键限制</dt>
                  <dd>
                    {profile.customFacts[0]?.value || '信息不足 / 待人工确认'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 · 导入消费者评论</span>
              <h2>评论数据</h2>
              <p>固定 Schema：review_id、rating、review_title、review_text</p>
            </div>
            <div className="upload-actions">
              <button className="button secondary" onClick={loadSample}>
                加载 Sample Data
              </button>
              <label className="button primary">
                <Upload size={15} />
                上传 CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={uploadCsv}
                  hidden
                />
              </label>
            </div>
          </div>
          {csvError && (
            <div className="error">
              <AlertTriangle size={16} />
              {csvError}
            </div>
          )}
          {sourceRows.length ? (
            <>
              <div className="file-line">
                <FileSearch size={18} />
                <span>{fileName}</span>
                <small>已读取固定 Schema</small>
              </div>
              <div className="metric-grid">
                <div>
                  <span>原始评论</span>
                  <strong>{cleaned.raw}</strong>
                </div>
                <div className="valid">
                  <span>有效评论</span>
                  <strong>{cleaned.valid.length}</strong>
                </div>
                <div>
                  <span>删除空数据</span>
                  <strong>{cleaned.empty}</strong>
                </div>
                <div>
                  <span>删除重复</span>
                  <strong>{cleaned.duplicate}</strong>
                </div>
              </div>
              <div className="run-row">
                <p>
                  {isSample
                    ? 'Sample 使用稳定演示规则；不消耗 API。'
                    : 'DeepSeek 将结合当前产品档案理解陌生评论。'}
                </p>
                <button
                  className="button primary run"
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                  {isAnalyzing ? '正在语义分析…' : '开始分析'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Upload size={28} />
              <strong>上传评论 CSV，或先用样本体验</strong>
              <span>数据不会用于实时市场趋势判断。</span>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">03 · 分析进度</span>
              <h2>处理进度</h2>
            </div>
            <span className={`status-pill ${step === 6 ? 'done' : ''}`}>
              {step === 6
                ? '分析完成'
                : sourceRows.length
                  ? '数据已就绪'
                  : '等待数据'}
            </span>
          </div>
          <div className="steps">
            {[
              '数据清洗',
              'AI 评论分类',
              '聚合统计',
              '用户洞察',
              '产品能力匹配',
              '运营动作',
            ].map((label, index) => (
              <div
                className={
                  step === 6 || (step >= 1 && index === 0) ? 'complete' : ''
                }
                key={label}
              >
                <span>
                  {step === 6 || (step >= 1 && index === 0) ? (
                    <Check size={14} />
                  ) : (
                    index + 1
                  )}
                </span>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <p className="method-note">
            <ShieldCheck size={16} />
            数量与比例由程序计算；陌生 CSV 的语义归纳使用 DeepSeek，最终决定仍需人工确认。
          </p>
        </section>
        {step === 6 && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">04 · 分析结果</span>
                <h2>用户洞察与运营判断</h2>
                <p>
                  {showAllInsights
                    ? '全部洞察与人工处理状态'
                    : pendingInsights.length
                      ? `待处理洞察 1 / ${pendingInsights.length}`
                      : '本轮洞察已处理完成'}
                  ；Evidence 始终来自原始评论。
                </p>
              </div>
              <div className="insight-view-actions">
                <span className="review-count">
                  {confirmedInsights.length}/{insights.length} 已处理
                </span>
                <button
                  className="button secondary"
                  onClick={() => setShowAllInsights(!showAllInsights)}
                >
                  {showAllInsights ? '返回逐条处理' : '查看全部洞察'}
                </button>
              </div>
            </div>
            <div className="insight-list">
              {visibleInsights.map((insight) => {
                const count = insight.reviewIds.length,
                  pct = cleaned.valid.length
                    ? ((count / cleaned.valid.length) * 100).toFixed(1)
                    : '0.0';
                const cta = decisionCta(insight, profile);
                const frequencyLabel =
                  Number(pct) >= 20
                    ? `高频${insight.sentiment}`
                    : insight.sentiment;
                return (
                  <article
                    className={`insight-card ${insight.status !== '待确认' ? 'confirmed' : ''}`}
                    key={insight.id}
                  >
                    <div className="insight-main">
                      <div className="insight-kicker">
                        <span
                          className={
                            insight.sentiment === '痛点'
                              ? 'negative'
                              : 'positive'
                          }
                        >
                          {frequencyLabel}
                        </span>
                        <span
                          className={`priority-badge priority-${insight.priority}`}
                        >
                          {insight.priority}优先级
                        </span>
                        <span
                          className={`handling-status status-${insight.status}`}
                        >
                          {insight.status}
                        </span>
                        {insight.listingAdopted && (
                          <span className="adopted-label">
                            <CircleCheck size={14} />
                            Listing 建议已采用
                          </span>
                        )}
                      </div>
                      <div className="insight-title-row">
                        <h3>{insight.title}</h3>
                        <div className="frequency">
                          <strong>{count}</strong>
                          <span>mentions · {pct}%</span>
                        </div>
                      </div>
                      <div className="insight-fields">
                        <div className="wide priority-reason">
                          <span>运营优先级判断</span>
                          <p>{insight.priorityReason}</p>
                        </div>
                        <div>
                          <span>用户需求</span>
                          <p>{insight.need}</p>
                        </div>
                        <div>
                          <span>核心使用场景</span>
                          <p>{insight.scenario}</p>
                        </div>
                        <div>
                          <span>产品匹配</span>
                          <p>{insight.productMatch}</p>
                        </div>
                        <div>
                          <span>当前 Listing 覆盖情况</span>
                          <p>{insight.listingCoverage}</p>
                        </div>
                        <div className="wide">
                          <span>建议行动</span>
                          <p>{insight.action}</p>
                        </div>
                      </div>
                      {editingJudgmentId === insight.id && (
                        <div className="judgment-editor">
                          {insight.tag === 'other' && (
                            <div className="manual-insight-fields">
                              <label>
                                洞察名称
                                <input
                                  value={insight.title}
                                  onChange={(event) =>
                                    updateInsight(insight.id, {
                                      title: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                用户需求
                                <input
                                  value={insight.need}
                                  onChange={(event) =>
                                    updateInsight(insight.id, {
                                      need: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                使用场景
                                <input
                                  value={insight.scenario}
                                  onChange={(event) =>
                                    updateInsight(insight.id, {
                                      scenario: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                处理路径
                                <select
                                  value={insight.manualRoute ?? ''}
                                  onChange={(event) =>
                                    updateInsight(insight.id, {
                                      manualRoute: event.target.value as
                                        | 'Listing'
                                        | '产品待确认'
                                        | '暂不处理',
                                    })
                                  }
                                >
                                  <option value="">请选择</option>
                                  <option>Listing</option>
                                  <option>产品待确认</option>
                                  <option>暂不处理</option>
                                </select>
                              </label>
                            </div>
                          )}
                          <div className="classification">
                            <span>问题分类</span>
                            <div>
                              {ALL_CLASSES.map((item) => (
                                <button
                                  key={item}
                                  className={
                                    insight.classification.includes(item)
                                      ? 'selected'
                                      : ''
                                  }
                                  onClick={() => toggleClass(insight.id, item)}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="priority-editor">
                            <label htmlFor={`priority-${insight.id}`}>
                              运营优先级
                            </label>
                            <select
                              id={`priority-${insight.id}`}
                              value={insight.priority}
                              onChange={(event) =>
                                updateInsight(insight.id, {
                                  priority: event.target.value as Priority,
                                })
                              }
                            >
                              <option>高</option>
                              <option>中</option>
                              <option>低</option>
                            </select>
                          </div>
                          <div className="handling-row">
                            <label htmlFor={`status-${insight.id}`}>
                              处理状态
                            </label>
                            <select
                              id={`status-${insight.id}`}
                              value={insight.status}
                              onChange={(event) => {
                                const requestedStatus = event.target
                                  .value as ActionStatus;
                                const canAdopt = Boolean(
                                  getListingSuggestion(insight, profile),
                                );
                                const status =
                                  requestedStatus === '已采用行动' && !canAdopt
                                    ? '已确认'
                                    : requestedStatus;
                                updateInsight(insight.id, {
                                  status,
                                  confirmed: status !== '待确认',
                                  listingAdopted:
                                    status === '已采用行动' ? true : false,
                                });
                              }}
                            >
                              {ALL_STATUSES.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      <div className="card-actions">
                        <div className="decision-tools">
                          <button
                            className="button secondary evidence-button"
                            onClick={() =>
                              setExpandedEvidence(
                                expandedEvidence === insight.id
                                  ? null
                                  : insight.id,
                              )
                            }
                          >
                            <FileSearch size={15} />
                            查看 Evidence · {count}
                            {expandedEvidence === insight.id ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                          <button
                            className="button secondary"
                            onClick={() =>
                              setEditingJudgmentId(
                                editingJudgmentId === insight.id
                                  ? null
                                  : insight.id,
                              )
                            }
                          >
                            <Pencil size={15} />
                            修改判断
                          </button>
                        </div>
                        <div>
                          {showAllInsights && (
                            <button
                              className="icon-button danger"
                              aria-label="删除洞察"
                              onClick={() => removeInsight(insight.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {insight.status === '待确认' ? (
                            <>
                              <button
                                className="button secondary"
                                onClick={() =>
                                  updateInsight(insight.id, {
                                    confirmed: true,
                                    status: '暂不处理',
                                    listingAdopted: false,
                                  })
                                }
                              >
                                暂不处理
                              </button>
                              <button
                                className="button primary"
                                onClick={() => {
                                  if (
                                    insight.tag === 'other' &&
                                    !insight.manualRoute
                                  ) {
                                    setEditingJudgmentId(insight.id);
                                    return;
                                  }
                                  updateInsight(insight.id, {
                                    confirmed: true,
                                    status: cta.outcome,
                                    listingAdopted: false,
                                  });
                                  if (cta.openListing)
                                    setListingInsightId(insight.id);
                                }}
                              >
                                <Check size={15} />
                                {cta.label}
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="decision-complete">
                                <CircleCheck size={15} />
                                {finalDecision(insight)}
                              </span>
                              {getListingSuggestion(insight, profile) &&
                                insight.priority !== '低' &&
                                insight.status !== '暂不处理' && (
                                  <button
                                    className="button accent"
                                    onClick={() =>
                                      setListingInsightId(insight.id)
                                    }
                                  >
                                    <Pencil size={15} />
                                    {insight.listingAdopted
                                      ? '查看 Listing 建议'
                                      : '进入 Listing 修改'}
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedEvidence === insight.id && (
                      <div className="evidence-panel">
                        <div className="evidence-header">
                          <strong>原始评论证据</strong>
                          <span>由 review_id 精确回溯，未经过 AI 改写</span>
                        </div>
                        {insight.reviewIds.slice(0, 5).map((id) => {
                          const review = cleaned.valid.find(
                            (r) => r.review_id === id,
                          );
                          return review ? (
                            <blockquote key={id}>
                              <div>
                                <span>{id}</span>
                                <span className="stars">
                                  {'★'.repeat(review.rating)}
                                  {'☆'.repeat(5 - review.rating)}
                                </span>
                              </div>
                              <strong>{review.review_title}</strong>
                              <p>“{review.review_text}”</p>
                            </blockquote>
                          ) : null;
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
              {!visibleInsights.length && !showAllInsights && (
                <div className="decision-finished">
                  <CircleCheck size={28} />
                  <strong>本轮洞察已处理完成</strong>
                  <span>
                    你可以查看全部洞察，或继续查看下方最终运营交付物。
                  </span>
                  <button
                    className="button secondary"
                    onClick={() => setShowAllInsights(true)}
                  >
                    查看全部洞察
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
        {step === 6 && pendingInsights.length === 0 && (
          <section className="panel action-summary">
            <div className="section-heading deliverable-heading">
              <div>
                <span className="eyebrow">05 · 最终输出</span>
                <h2>本次运营行动方案</h2>
                <p>把已确认结论整理为可以直接复制和继续执行的方案。</p>
              </div>
              <button
                className="button primary copy-all"
                onClick={() => copyText('all', actionPlanText())}
              >
                {copiedKey === 'all' ? (
                  <>
                    <Check size={15} />
                    已复制
                  </>
                ) : copiedKey === 'error:all' ? (
                  <>
                    <AlertTriangle size={15} />
                    复制失败
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={15} />
                    复制全部
                  </>
                )}
              </button>
            </div>
            <div className="plan-summary-strip">
              <div>
                <span>有效评论</span>
                <strong>{cleaned.valid.length}</strong>
              </div>
              <div>
                <span>已确认核心洞察</span>
                <strong>{confirmedInsights.length}</strong>
              </div>
              <div>
                <span>Listing 待执行</span>
                <strong>{adoptedListings.length}</strong>
              </div>
              <div>
                <span>产品侧待办</span>
                <strong>{productTodos.length}</strong>
              </div>
            </div>
            {!confirmedInsights.length ? (
              <div className="summary-empty">
                确认洞察或设置处理状态后，完整行动方案会自动出现在这里。
              </div>
            ) : (
              <div className="action-plan-body">
                <section className="plan-block listing-draft">
                  <div className="deliverable-section-title">
                    <div>
                      <span>A</span>
                      <div>
                        <h3>最终 Listing 草稿</h3>
                        <p>
                          未高亮位置为原始 / Sample Listing 内容，本轮 Workflow
                          仅修改经过人工确认且有产品事实支持的位置。
                        </p>
                      </div>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() =>
                        copyText('full-listing', fullListingText())
                      }
                    >
                      {copiedKey === 'full-listing' ? (
                        <>
                          <Check size={15} />
                          已复制
                        </>
                      ) : (
                        '复制完整 Listing'
                      )}
                    </button>
                  </div>
                  <div className="listing-structure">
                    <article className="original">
                      <span>Title</span>
                      <p>{listingDraft.title}</p>
                      <small>基于 Product Profile 的原始产品信息</small>
                    </article>
                    {listingDraft.bullets.map((bullet, index) => {
                      const source = adoptedListings.find(
                        (i) => listingBulletIndex(i) === index,
                      );
                      return (
                        <article
                          className={source ? 'modified' : 'original'}
                          key={index}
                        >
                          <span>Bullet Point {index + 1}</span>
                          <p>{bullet}</p>
                          {source && (
                            <small>
                              Modified from insight: {source.title} · Claim
                              Check: Supported
                            </small>
                          )}
                          {!source && <small>原始 / Sample Listing 内容</small>}
                        </article>
                      );
                    })}
                    <article className="original">
                      <span>Description / A+</span>
                      <p>{listingDraft.description}</p>
                      <small>原始 / Sample Listing 内容</small>
                    </article>
                  </div>
                  {listingDraft.images.length > 0 && (
                    <div className="image-recommendations">
                      <strong>图片内容建议</strong>
                      {listingDraft.images.map((item, index) => (
                        <p key={index}>{item}</p>
                      ))}
                    </div>
                  )}
                  <div className="listing-audit">
                    <strong>完整 Listing 检查</strong>
                    <div>
                      <span
                        className={
                          listingAudit.noRouteConflict ? 'pass' : 'warning'
                        }
                      >
                        {listingAudit.noRouteConflict ? '✓' : '⚠'} 位置冲突：
                        {listingAudit.noRouteConflict
                          ? '每条建议已落到独立位置'
                          : '同一位置存在多个候选，未静默覆盖'}
                      </span>
                      <span
                        className={
                          listingAudit.factsSupported ? 'pass' : 'warning'
                        }
                      >
                        {listingAudit.factsSupported ? '✓' : '⚠'} 产品事实：
                        {listingAudit.factsSupported
                          ? '所有新增宣称均有档案事实支持'
                          : '存在未经确认的产品事实'}
                      </span>
                      <span className="pass">
                        ✓ 信息层级：场景 → 核心性能 → 清洁 → 携带 → 日常使用
                      </span>
                      <span
                        className={productTodos.length ? 'warning' : 'pass'}
                      >
                        {productTodos.length ? '⚠' : '✓'} 待产品确认：
                        {productTodos.length
                          ? `${productTodos.length} 项尚未确认，均未写入 Listing`
                          : '无待确认卖点'}
                      </span>
                    </div>
                  </div>
                </section>
                <section className="plan-block">
                  <div className="deliverable-section-title">
                    <div>
                      <span>B</span>
                      <div>
                        <h3>产品 / 供应链待办</h3>
                        <p>可直接复制给协作同事的验证需求。</p>
                      </div>
                    </div>
                  </div>
                  {productTodos.length ? (
                    <div className="request-card-list">
                      {productTodos.map((insight) => {
                        const card = productRequest(
                          insight,
                          frequencyText(insight),
                        );
                        const text = [
                          `# ${collaborationTitle(insight)}`,
                          `优先级：${insight.priority}`,
                          '协作对象：产品 / 供应链',
                          '当前状态：待确认',
                          `问题背景：${card.background}`,
                          '原始 Evidence：',
                          ...insight.reviewIds.map((id) => {
                            const review = cleaned.valid.find(
                              (item) => item.review_id === id,
                            );
                            return review
                              ? `- ${id}｜${review.review_title}：${review.review_text}`
                              : `- ${id}`;
                          }),
                          `为什么需要确认：${card.why}`,
                          '需要确认的问题：',
                          ...card.questions.map((q) => `- ${q}`),
                          '希望返回的信息：',
                          ...card.returns.map((item) => `- ${item}`),
                          `运营后续动作：${card.next}`,
                          '闭环路径：待产品确认 → 产品返回事实 → 更新 Product Profile → 重新判断是否可以进入 Listing',
                        ].join('\n');
                        return (
                          <article className="request-card" key={insight.id}>
                            <div className="plan-item-title">
                              <strong>{collaborationTitle(insight)}</strong>
                              <span>{insight.priority}优先级</span>
                            </div>
                            <dl>
                              <div>
                                <dt>协作对象</dt>
                                <dd>产品 / 供应链</dd>
                              </div>
                              <div>
                                <dt>当前状态</dt>
                                <dd>待确认</dd>
                              </div>
                              <div>
                                <dt>问题背景</dt>
                                <dd>{card.background}</dd>
                              </div>
                              <div>
                                <dt>Evidence</dt>
                                <dd>
                                  <ul className="request-evidence">
                                    {insight.reviewIds.map((id) => {
                                      const review = cleaned.valid.find(
                                        (item) => item.review_id === id,
                                      );
                                      return (
                                        <li key={id}>
                                          <strong>{id}</strong>
                                          {review
                                            ? `｜${review.review_title}：“${review.review_text}”`
                                            : ''}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </dd>
                              </div>
                              <div>
                                <dt>为什么需要确认</dt>
                                <dd>{card.why}</dd>
                              </div>
                              <div>
                                <dt>需要确认的问题</dt>
                                <dd>
                                  <ul>
                                    {card.questions.map((q) => (
                                      <li key={q}>{q}</li>
                                    ))}
                                  </ul>
                                </dd>
                              </div>
                              <div>
                                <dt>希望返回的信息</dt>
                                <dd>{card.returns.join('、')}</dd>
                              </div>
                              <div>
                                <dt>运营后续动作</dt>
                                <dd>{card.next}</dd>
                              </div>
                              <div>
                                <dt>闭环路径</dt>
                                <dd>
                                  待产品确认 → 产品返回事实 → 更新 Product
                                  Profile → 重新判断是否可以进入 Listing
                                </dd>
                              </div>
                            </dl>
                            <button
                              className="button secondary"
                              onClick={() =>
                                copyText(`request-${insight.id}`, text)
                              }
                            >
                              {copiedKey === `request-${insight.id}` ? (
                                <>
                                  <Check size={15} />
                                  已复制
                                </>
                              ) : (
                                '复制需求卡'
                              )}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="plan-none">暂无产品侧待确认事项。</p>
                  )}
                </section>
                <section className="plan-block">
                  <div className="deliverable-section-title">
                    <div>
                      <span>C</span>
                      <div>
                        <h3>本轮运营复盘</h3>
                        <p>记录人工最终决定，而不是 AI 的原始建议。</p>
                      </div>
                    </div>
                  </div>
                  <div className="review-grid">
                    <div>
                      <strong>评论数据</strong>
                      <p>
                        原始 {cleaned.raw} 条 · 有效 {cleaned.valid.length} 条
                      </p>
                    </div>
                    <div>
                      <strong>洞察优先级</strong>
                      <p>
                        高 {insights.filter((i) => i.priority === '高').length}{' '}
                        · 中{' '}
                        {insights.filter((i) => i.priority === '中').length} ·
                        低 {insights.filter((i) => i.priority === '低').length}
                      </p>
                    </div>
                    <div>
                      <strong>本轮决定</strong>
                      <p>
                        Listing 修改 {adoptedListings.length} · 产品待确认{' '}
                        {productTodos.length} · 暂不处理{' '}
                        {
                          confirmedInsights.filter(
                            (i) => i.status === '暂不处理',
                          ).length
                        }
                      </p>
                    </div>
                    <div>
                      <strong>核心用户需求</strong>
                      <p>
                        {confirmedInsights.map((i) => i.need).join('；') ||
                          '待人工确认'}
                      </p>
                    </div>
                    <div>
                      <strong>已经采取的行动</strong>
                      <p>
                        {adoptedListings
                          .map((i) => `${i.title}：${listingPlacement(i)}`)
                          .join('；') || '暂无'}
                      </p>
                    </div>
                    <div>
                      <strong>下一步</strong>
                      <p>
                        {productTodos
                          .map((i) => `${i.title}：${i.action}`)
                          .join('；') || '暂无产品侧待办'}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
        )}
        <Sheet
          open={Boolean(selectedInsight)}
          onOpenChange={(open) => {
            if (!open) setListingInsightId(null);
          }}
        >
          {selectedInsight && (
            <SheetContent className="listing-drawer" showCloseButton>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Listing 修改建议</span>
                  <SheetHeader className="drawer-header">
                    <SheetTitle>针对性 Listing 修改建议</SheetTitle>
                    <SheetDescription>
                      仅基于已确认洞察与产品事实，不重写整个详情页。
                    </SheetDescription>
                  </SheetHeader>
                </div>
              </div>
              <div className="listing-context">
                <div>
                  <span>来源洞察</span>
                  <strong>{selectedInsight.title}</strong>
                </div>
                <div>
                  <span>用户需求</span>
                  <strong>{selectedInsight.need}</strong>
                </div>
                <div>
                  <span>产品匹配</span>
                  <strong>{selectedInsight.productMatch}</strong>
                </div>
                <div>
                  <span>运营优先级</span>
                  <strong>
                    {selectedInsight.priority} ·{' '}
                    {selectedInsight.priorityReason}
                  </strong>
                </div>
                <div>
                  <span>建议修改位置</span>
                  <strong>{listingPlacement(selectedInsight)}</strong>
                </div>
                <div>
                  <span>修改原因</span>
                  <strong>{placementReason(selectedInsight)}</strong>
                </div>
              </div>
              <div className="copy-compare">
                <div>
                  <span>修改前</span>
                  <p>{currentPlacementCopy(selectedInsight, profile)}</p>
                </div>
                <div className="after">
                  <span>建议修改后</span>
                  {listingAfter ? (
                    <p>{listingAfter}</p>
                  ) : (
                    <p className="warning-copy">
                      ⚠ 缺少产品事实支持，建议先确认产品能力。
                    </p>
                  )}
                </div>
              </div>
              {imageSuggestion(selectedInsight) && (
                <div className="drawer-image-suggestion">
                  <span>配套图片内容建议</span>
                  <p>{imageSuggestion(selectedInsight)}</p>
                </div>
              )}
              <div
                className={`claim-check ${listingAfter ? 'supported' : 'warning'}`}
              >
                <div className="claim-icon">
                  {listingAfter ? (
                    <ShieldCheck size={23} />
                  ) : (
                    <AlertTriangle size={23} />
                  )}
                </div>
                <div>
                  <span>Claim Check · {claimStatus}</span>
                  <strong>
                    {listingAfter
                      ? `事实依据：${factEvidence(selectedInsight, profile)}`
                      : '当前产品档案没有足够事实支持具体宣称'}
                  </strong>
                  <p>
                    {listingAfter
                      ? '建议文案未超出已确认事实；仍需人工最终确认。'
                      : '系统已停止生成具体产品能力表述。'}
                  </p>
                </div>
              </div>
              <div className="final-review">
                <div>
                  <ClipboardCheck size={19} />
                  <span>
                    <strong>最终决定由你完成</strong>
                    <small>Claim Check 不是法律合规审查。</small>
                  </span>
                </div>
                {selectedInsight.listingAdopted ? (
                  <button
                    className="button secondary"
                    onClick={() =>
                      updateInsight(selectedInsight.id, {
                        confirmed: true,
                        status: '已确认',
                        listingAdopted: false,
                      })
                    }
                  >
                    取消采用
                  </button>
                ) : (
                  <button
                    disabled={!listingAfter}
                    className="button primary"
                    onClick={() =>
                      updateInsight(selectedInsight.id, {
                        confirmed: true,
                        status: '已采用行动',
                        listingAdopted: true,
                      })
                    }
                  >
                    确认采用建议
                  </button>
                )}
              </div>
            </SheetContent>
          )}
        </Sheet>
      </div>
      {showDeepSeekSettings && (
        <div className="api-modal-backdrop" role="presentation">
          <dialog open className="api-modal" aria-labelledby="deepseek-title">
            <div className="api-modal-heading">
              <div>
                <span className="eyebrow">本地 AI 设置</span>
                <h2 id="deepseek-title">连接 DeepSeek API</h2>
              </div>
              <button className="modal-close" onClick={() => setShowDeepSeekSettings(false)} aria-label="关闭">×</button>
            </div>
            <p>
              用于分析陌生 CSV。Key 仅保存在这台设备的当前浏览器，
              不会写入 GitHub 或我们的云端。
            </p>
            <label className="api-key-field">
              <span>DeepSeek API Key</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                value={deepSeekKey}
                onChange={(event) => {
                  setDeepSeekKey(event.target.value);
                  setDeepSeekStatus('idle');
                  setDeepSeekMessage('');
                }}
              />
            </label>
            <div className="api-security-note">
              <ShieldCheck size={18} />
              <span>请仅在个人可信设备上保存。分析时，Key 与必要数据会直接发送给 DeepSeek 官方 API。</span>
            </div>
            {deepSeekMessage && (
              <p className={`api-message ${deepSeekStatus}`}>{deepSeekMessage}</p>
            )}
            <div className="api-modal-actions">
              {deepSeekKey && deepSeekStatus === 'connected' && (
                <button className="button secondary" onClick={disconnectDeepSeek}>
                  删除本地密钥
                </button>
              )}
              <button className="button primary" disabled={deepSeekStatus === 'testing'} onClick={connectDeepSeek}>
                {deepSeekStatus === 'testing' ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />}
                {deepSeekStatus === 'testing' ? '正在测试…' : '测试并保存'}
              </button>
            </div>
          </dialog>
        </div>
      )}
      <footer>
        CODE 负责确定性任务 · AI 负责语言理解 · HUMAN 负责产品事实与最终决策
      </footer>
    </main>
  );
}
