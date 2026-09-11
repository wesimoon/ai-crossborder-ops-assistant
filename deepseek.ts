export type DeepSeekReview = {
  review_id: string;
  rating: number;
  review_title: string;
  review_text: string;
};

export type DeepSeekProfile = {
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

export type DeepSeekTheme = {
  key: string;
  title: string;
  sentiment: '痛点' | '满意点';
  userNeed: string;
  scenario: string;
  severity: string;
  priority: '高' | '中' | '低';
  priorityReason: string;
  reviewIds: string[];
  classification: ('产品问题' | 'Listing 信息问题' | '用户预期问题' | '信息不足')[];
  productMatch: string;
  listingCoverage: string;
  recommendedAction: string;
  route: 'Listing' | '产品待确认' | '暂不处理' | '待人工归类';
  matchedFact: string | null;
  listingPosition: string | null;
  listingCopy: string | null;
};

const ENDPOINT = 'https://api.deepseek.com/chat/completions';

function extractJson(content: string) {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed) as { themes?: DeepSeekTheme[] };
}

function validateThemes(value: unknown, reviews: DeepSeekReview[]) {
  if (!Array.isArray(value)) throw new Error('模型未返回有效的洞察列表');
  const validIds = new Set(reviews.map((review) => review.review_id));
  return value
    .filter((item): item is DeepSeekTheme => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      ...item,
      key: String(item.key || `theme-${index + 1}`),
      title: String(item.title || '待人工归类反馈'),
      userNeed: String(item.userNeed || '待人工确认'),
      scenario: String(item.scenario || '待人工确认'),
      severity: String(item.severity || '待人工确认'),
      priorityReason: String(item.priorityReason || '待人工确认'),
      productMatch: String(item.productMatch || '信息不足 / 待人工确认'),
      listingCoverage: String(item.listingCoverage || '待人工确认'),
      recommendedAction: String(item.recommendedAction || '请人工检查 Evidence'),
      reviewIds: Array.isArray(item.reviewIds)
        ? [...new Set(item.reviewIds.map(String).filter((id) => validIds.has(id)))]
        : [],
      classification: Array.isArray(item.classification) ? item.classification : ['信息不足'],
      sentiment: item.sentiment === '满意点' ? '满意点' : '痛点',
      priority: ['高', '中', '低'].includes(item.priority) ? item.priority : '中',
      route: ['Listing', '产品待确认', '暂不处理', '待人工归类'].includes(item.route)
        ? item.route
        : '待人工归类',
      matchedFact: item.matchedFact ? String(item.matchedFact) : null,
      listingPosition: item.listingPosition ? String(item.listingPosition) : null,
      listingCopy: item.listingCopy ? String(item.listingCopy) : null,
    }))
    .filter((theme) => theme.reviewIds.length > 0) as DeepSeekTheme[];
}

export async function testDeepSeekKey(apiKey: string) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'API Key 无效' : `DeepSeek 连接失败（${response.status}）`);
  return true;
}

export async function analyzeWithDeepSeek(
  apiKey: string,
  profile: DeepSeekProfile,
  reviews: DeepSeekReview[],
) {
  const prompt = `
你是跨境电商评论分析助手。请用中文返回 json，且只返回 json。

原则：
1. 仅根据本次产品档案理解产品，不得假设是保温杯，不得使用预设品类主题。
2. 将语义相同的反馈归纳为简短、可执行的运营洞察；不要拼接原文词组当主题。
3. 无法可靠归纳时，title 必须为“待人工归类反馈”，route 必须为“待人工归类”。
4. 模型只做语义理解。产品性能不能由评论推断；只能引用产品档案中已明确的事实。
5. 只有 matchedFact 引用了档案中明确事实，且当前 Listing 未充分覆盖时，才允许 route=Listing 并提供 listingCopy。
6. 优先级综合频次、情绪/严重程度、核心场景、购买/使用影响、产品事实和 Listing 覆盖，不得简化为频率高=高优先级。
7. reviewIds 只能使用输入的 review_id。一条评论可以支持多个不同洞察。
8. 最多返回 8 个核心洞察（包括“待人工归类反馈”）。优先合并相同需求；低置信、低影响的零散单条反馈放入一个“待人工归类反馈”，不要为减少待归类而强行归纳。严重功能/安全问题即使只有一条也可单独成为洞察。

返回格式：
{"themes":[{"key":"stable-slug","title":"结构化洞察名","sentiment":"痛点|满意点","userNeed":"用户需求","scenario":"使用场景","severity":"严重程度及原因","priority":"高|中|低","priorityReason":"综合理由","reviewIds":["R-1"],"classification":["产品问题|Listing 信息问题|用户预期问题|信息不足"],"productMatch":"匹配结论","listingCoverage":"当前覆盖","recommendedAction":"建议行动","route":"Listing|产品待确认|暂不处理|待人工归类","matchedFact":"档案中的准确事实或null","listingPosition":"Title|Bullet Point 1|Bullet Point 2|Bullet Point 3|Bullet Point 4|Bullet Point 5|Description / A+|Product Image / Infographic|null","listingCopy":"有事实支持的英文Listing文案或null"}]}

当前产品档案：
${JSON.stringify(profile)}

本次有效评论：
${JSON.stringify(reviews)}
`;
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你只输出符合要求的 json 对象。' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 6000,
    }),
  });
  if (!response.ok) {
    const message = response.status === 401 ? 'API Key 无效，请重新连接' : `DeepSeek 分析失败（${response.status}）`;
    throw new Error(message);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 未返回分析结果');
  const profileFacts = JSON.stringify(profile).toLowerCase();
  return validateThemes(extractJson(content).themes, reviews).map((theme) => {
    const factIsVerifiable = Boolean(
      theme.matchedFact && profileFacts.includes(theme.matchedFact.trim().toLowerCase()),
    );
    if (theme.route !== 'Listing' || factIsVerifiable) return theme;
    return {
      ...theme,
      route: '产品待确认' as const,
      matchedFact: null,
      listingPosition: null,
      listingCopy: null,
      productMatch: '信息不足：模型未能引用产品档案中可验证的原文事实',
      recommendedAction: '先由产品 / 供应链确认事实，更新产品档案后再判断是否进入 Listing。',
    };
  });
}
