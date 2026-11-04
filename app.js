/* PromptUplift: dependency-free, deterministic, browser-local rules. */
(() => {
  'use strict';

  const MAX_LENGTH = 20000;
  const PATTERNS = {
    action: /\b(?:write|create|generate|analy[sz]e|summari[sz]e|explain|translate|compare|draft|list|design|rewrite|describe|review|classify|extract|evaluate|build|plan|calculate|debug|fix|compose)\b|撰写|写(?:一|出|作|篇|个|封|份|段)|生成|创建|分析|总结|解释|翻译|比较|对比|列出|设计|改写|描述|评估|提取|制定|计算|修复/i,
    weakAction: /\b(?:help|make|improve|do)\b|帮我|优化|处理|做一下/i,
    context: /\b(?:context|background|situation)\s*[:：]\s*\S[^\n.!?]{8,}|\b(?:i|we)\s+(?:run|own|work|sell|am working|are building|am launching|are launching)\s+\S[^\n.!?]{8,}|\bour\s+(?:company|product|business|team|store)\s+\S[^\n.!?]{8,}|(?:背景|情境|现状|用途)\s*[:：]\s*[^\s。！？]{5,}|(?:我|我们)(?:经营|正在|计划|准备|开了|有一家|是一家)[^。！？\n]{5,}/i,
    weakContext: /\b(?:about|regarding|topic|because|working on)\s+\S[^\n.!?]{3,}|(?:关于|主题|因为|针对)[^。！？\n]{2,}/i,
    format: /\b(?:markdown|json|csv|html|table|bullet(?:s| points)?|numbered list|checklist|step-by-step|headings?|plain text|code block)\b|表格|列表|要点|分点|分步|标题|纯文本|代码块|格式\s*[:：]\s*[^\s。！？]{2,}/i,
    length: /\b\d+(?:\s*[-–]\s*\d+)?\s*[- ]?\s*(?:words?|characters?|paragraphs?|sentences?|bullet points?|items?|pages?)\b|\d+(?:\s*[-–到至]\s*\d+)?\s*(?:字|词|段|句|行|页|个要点|个步骤)/i,
    audience: /\b(?:audience|readers|users)\s*[:：]\s*\S[^\n.!?]{3,}|\b(?:for|aimed at|targeting|intended for)\s+(?:[a-z-]+\s+){0,5}(?:beginners|students|children|kids|parents|teachers|developers|engineers|marketers|professionals|founders|managers|customers|executives|designers|researchers|seniors|adults|teenagers|business owners)\b|(?:受众|读者|用户群体|面向人群)\s*[:：]\s*[^\s。！？]{2,}|(?:为|面向|写给|给)[^。！？\n]{0,20}(?:新手|初学者|学生|大学生|儿童|家长|老师|教师|开发者|程序员|管理者|客户|设计师|创业者|老年人|青少年|上班族)/i,
    weakAudience: /\bfor\s+(?:people|users|readers|everyone|the public)\b|给大家|面向大众|普通人|所有人/i,
    restriction: /\b(?:do not|don't|must not|avoid|without|only use|must include|never|no jargon|no claims)\b|不要|不得|禁止|避免|不允许|只使用|只用|必须包含|不能/i,
    tone: /\b(?:friendly|professional|formal|casual|warm|neutral|concise|persuasive|conversational|empathetic|playful|academic|clear|simple)\s+(?:tone|voice|style|language)\b|\b(?:tone|voice|style)\s*[:：]\s*\S[^\n.!?]{2,}|(?:语气|口吻|风格)\s*[:：为是用]?\s*[^\s。！？]{2,}|(?:用|使用|保持)(?:亲切|友好|专业|正式|轻松|简洁|中立|通俗|温暖)/i,
    role: /\b(?:you are|act as|your role is)\s+(?:(?:an?|the)\s+)?[a-z][a-z-]{2,}(?:\s+[a-z][a-z-]*){0,5}|(?:你是|扮演|你的角色是)(?:一[名位个])?[^\s，。！？：:\n]{2,}/i,
    weakRole: /\b(?:expert|specialist|consultant|copywriter|editor)\b|专家|顾问|编辑|文案师/i,
    example: /(?:\b(?:example|examples|e\.g\.)\s*[:：]\s*|(?:示例|例子|例如|比如)\s*[:：]?\s*)[^\n]{8,}/i,
    weakExample: /\b(?:such as|for example)\s+\S[^\n]{2,}|例如|比如|示例|例子/i,
    vague: /\b(?:maybe|somehow|something nice|better|as much as possible|roughly|kind of|sort of|good enough)\b|大概|尽量|好一点|随便|差不多|适当|看着办/gi
  };

  // Index 0 = missing, 1 = partial, 2 = pass. Suggestions always remain bilingual.
  const RULES = [
    { id: 'task', weight: 20, en: 'Clear task', zh: '明确的任务动词', tips: [
      ['Start with a concrete verb such as write, compare, or analyze.', '用“撰写、比较、分析”等具体动作说明要做什么。'],
      ['Replace a broad verb like help or improve with a specific action.', '把“帮我、优化”等宽泛表达换成明确的动作。'],
      ['Keep the action verb and make the expected deliverable explicit.', '保留明确的动作词，并说清最终要交付什么。']] },
    { id: 'context', weight: 15, en: 'Background & context', zh: '上下文背景', tips: [
      ['Add your situation and purpose after “Context:”.', '在“背景：”后补充当前情况和用途。'],
      ['Go beyond the topic and explain the situation behind the request.', '除了主题，再交代提出这个需求的具体背景。'],
      ['Keep the background focused on facts that affect the task.', '保留会影响任务结果的关键背景事实。']] },
    { id: 'format', weight: 15, en: 'Output format & length', zh: '输出格式与长度', tips: [
      ['Specify both a format, such as a table, and a length limit.', '同时指定表格等输出格式和字数等长度要求。'],
      ['Add the missing format or length so the output is predictable.', '补上缺少的格式或长度，让输出更可控。'],
      ['Keep the format and length measurable and consistent.', '让格式和长度要求可衡量，且彼此不冲突。']] },
    { id: 'audience', weight: 10, en: 'Target audience', zh: '目标受众', tips: [
      ['Name who will read or use the result and their experience level.', '说明谁会阅读或使用结果，以及他们的经验水平。'],
      ['Replace a broad audience like everyone with a specific group.', '把“所有人”等宽泛受众细化为具体人群。'],
      ['Keep the audience explicit and add their needs if relevant.', '保留清楚的受众描述，必要时补充他们的需求。']] },
    { id: 'constraints', weight: 10, en: 'Constraints & tone', zh: '约束条件与语气', tips: [
      ['Add a boundary, such as no invented facts, and a preferred tone.', '补充“不编造事实”等边界和希望使用的语气。'],
      ['Add the missing restriction or tone to guide the response.', '补上缺少的约束条件或语气要求。'],
      ['Keep the restrictions practical and the tone appropriate.', '确保约束可执行，语气适合实际使用场景。']] },
    { id: 'role', weight: 8, en: 'Role or perspective', zh: '角色设定', tips: [
      ['Add “You are…” followed by the role relevant to your task.', '用“你是……”指定与任务相关的角色。'],
      ['Make the role explicit, for example “You are a copywriter”.', '把角色说完整，例如“你是一名文案编辑”。'],
      ['Keep the role relevant and specify expertise when useful.', '保留相关角色，必要时注明所需专业方向。']] },
    { id: 'examples', weight: 8, en: 'A useful example', zh: '示例', tips: [
      ['Add “Example:” followed by a short sample of the desired result.', '在“示例：”后提供一小段期望的输出。'],
      ['Include a concrete sample, rather than only mentioning examples.', '提供具体样例，不要只写“例如”或“示例”。'],
      ['Keep the example aligned with the requested format and tone.', '确保示例与要求的输出格式和语气一致。']] },
    { id: 'specificity', weight: 6, en: 'Specific wording', zh: '具体措辞', tips: [
      ['Replace vague wording with measurable, concrete requirements.', '把模糊措辞替换成可衡量的具体要求。'],
      ['Clarify broad wording and add the details needed to act on it.', '澄清宽泛措辞，补上执行任务所需的细节。'],
      ['Keep the wording concrete and check for any hidden ambiguity.', '保留具体表达，并检查是否还有隐含的歧义。']] }
  ];

  function inspect(input) {
    // An unfilled placeholder is a request for information, never evidence of it.
    const source = String(input);
    const onlyBracketedHints = source.includes('[') && !/[a-z\u3400-\u9fff\d]/i.test(source.replace(/\[[^\]]*\]/g, ''));
    const text = (onlyBracketedHints ? '' : source)
      .replace(/\[(?:待补充|待填写|To fill|Add)\s*[:：][^\]]*\]/gi, '')
      .replace(/\[(?:your\b|insert\b|enter\b|describe\b|请填写|在此填|这里填)[^\]]*\]|\[[^\]\n]*\bhere\b[^\]]*\]/gi, '')
      .trim();
    const signals = {};
    for (const [key, pattern] of Object.entries(PATTERNS)) {
      if (key !== 'vague') signals[key] = pattern.test(text);
    }
    signals.vagueCount = (text.match(PATTERNS.vague) || []).length;
    signals.size = text.replace(/\s/g, '').length;
    return { text, signals };
  }

  function analyze(input) {
    const { text, signals: s } = inspect(input);
    const levels = {
      task: s.action ? 1 : s.weakAction ? 0.5 : 0,
      context: s.context ? 1 : s.weakContext ? 0.5 : 0,
      format: (Number(s.format) + Number(s.length)) / 2,
      audience: s.audience ? 1 : s.weakAudience ? 0.5 : 0,
      constraints: (Number(s.restriction) + Number(s.tone)) / 2,
      role: s.role ? 1 : s.weakRole ? 0.5 : 0,
      examples: s.example ? 1 : s.weakExample ? 0.5 : 0,
      specificity: !text || s.vagueCount >= 2 ? 0 : s.vagueCount || s.size < 20 ? 0.5 : 1
    };
    const items = RULES.map(rule => {
      const level = text ? levels[rule.id] : 0;
      const tip = rule.tips[level * 2];
      return { id: rule.id, weight: rule.weight, en: rule.en, zh: rule.zh, level,
        points: rule.weight * level, advice: { en: tip[0], zh: tip[1] } };
    });
    const raw = items.reduce((sum, item) => sum + item.points, 0);
    return { items, raw, score: Math.round(raw / 92 * 100) };
  }

  function detectLanguage(text) {
    const han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (text.match(/[a-z]+/gi) || []).length;
    return han >= 2 && han > words * 2 ? 'zh' : 'en';
  }

  function optimize(input) {
    const original = String(input).trim();
    const language = detectLanguage(original);
    const zh = language === 'zh';
    const { signals: s } = inspect(original);
    const groups = { Task: [], Context: [], Format: [], Constraints: [] };
    // Mask code, quotations and labelled example blocks before splitting. This
    // keeps quoted source text and example conversations together and prevents
    // their wording from overriding the enclosing instruction's category.
    let prefix = '\uE000PU';
    while (original.includes(prefix)) prefix += '_';
    const protectedParts = [];
    const exampleTokens = new Set();
    const protect = value => {
      const token = `${prefix}${protectedParts.length}\uE001`;
      protectedParts.push({ token, value });
      return token;
    };
    const masked = original.replace(/```[\s\S]*?```/g, protect)
      .replace(/"[^"\n]*(?:\n[^"\n]*)*"|“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’/g, protect)
      .replace(/^(?:Examples?|示例|例子)\s*[:：][^\r\n]*(?:\r?\n(?!\s*(?:\r?\n|$)|(?:Task|Context|Format|Constraints|Role|Tone|Audience|Background|任务|背景|格式|约束|角色|语气|受众)\s*[:：])[^\r\n]+)*/gmi,
        value => {
          const token = protect(value);
          exampleTokens.add(token);
          return `Example: ${token}`;
        });
    const restore = value => {
      for (let i = protectedParts.length - 1; i >= 0; i--) {
        const part = protectedParts[i];
        value = value.split(part.token).join(part.value);
      }
      return value;
    };
    const fragments = masked.split(/(?<=[。！？])(?=\S)|(?<=[.!?。！？])\s+(?=\S)|[\r\n]+(?=(?:Task|Context|Format|Constraints|Examples?|Role|Tone|Audience|Background|任务|背景|格式|约束|示例|例子|角色|语气|受众)\s*[:：])/u);
    for (const fragment of fragments.filter(part => part.trim())) {
      const classified = fragment.trim();
      const isExampleBlock = classified.startsWith('Example: ') && exampleTokens.has(classified.slice('Example: '.length));
      const value = restore(isExampleBlock ? classified.slice('Example: '.length) : classified);
      const { signals: f } = inspect(classified);
      let key = 'Task';
      if (/^(?:context|背景)\s*[:：]/i.test(classified) || isExampleBlock || f.role || f.context || f.example || f.weakExample) key = 'Context';
      else if (/^(?:format|格式)\s*[:：]/i.test(classified)) key = 'Format';
      else if (/^(?:constraints|约束|语气|tone)\s*[:：]/i.test(classified)) key = 'Constraints';
      else if (f.restriction || f.tone) key = 'Constraints';
      else if (f.action || f.weakAction) key = 'Task';
      else if (f.format || f.length) key = 'Format';
      else if (f.audience) key = 'Context';
      groups[key].push(value);
    }
    let added = 0;
    const add = (key, english, chinese) => {
      groups[key].push(zh ? `[待补充：${chinese}]` : `[To fill: ${english}]`);
      added++;
    };
    if (!s.action) add('Task', 'a specific action and desired deliverable', '明确的任务动作与交付内容');
    if (!s.context) add('Context', 'background and purpose', '背景与用途');
    if (!s.audience) add('Context', 'target audience and experience level', '目标受众与经验水平');
    if (!s.role) add('Context', 'the role the assistant should take', '希望助手扮演的角色');
    if (!s.example) add('Context', 'a short example of the desired result, if useful', '期望输出的简短示例（如适用）');
    if (!s.format) add('Format', 'output format, such as a table or bullet list', '输出格式，例如表格或要点列表');
    if (!s.length) add('Format', 'a measurable length, such as a word count', '可衡量的长度，例如字数');
    if (!s.restriction) add('Constraints', 'what to include or avoid', '必须包含或避免的内容');
    if (!s.tone) add('Constraints', 'preferred tone', '期望的语气');
    if (s.vagueCount) add('Constraints', 'replace vague terms in the original with measurable requirements', '将原文中的模糊词替换为可衡量要求');
    const names = { Task: '任务', Context: '背景', Format: '格式', Constraints: '约束' };
    const text = Object.entries(groups).map(([key, entries]) => {
      const content = entries.length ? entries.join('\n\n') :
        (zh ? '相关要求已保留在其他段落的原文中，请核对。' : 'Relevant requirements are preserved in the original text in another section; please review.');
      return `${key}${zh ? ` · ${names[key]}` : ''}\n${content}`;
    }).join('\n\n--------------------\n\n');
    return { text, language, changes: [
      { en: 'Grouped your original text into Task, Context, Format, and Constraints.', zh: '将原文整理为任务、背景、格式和约束四段。' },
      { en: 'Preserved your original facts and wording without inventing details.', zh: '保留原有事实和措辞，没有编造细节。' },
      { en: added ? `Added ${added} clearly marked placeholders for missing or unclear requirements.` : 'Found no missing requirements under the current rules; no placeholders were added.', zh: added ? `用 ${added} 处占位提示标出缺失或不清楚的要求。` : '按当前规则未发现缺失要求，因此没有添加占位提示。' },
      { en: 'Kept the prompt’s language; review the structure and fill in placeholders before use.', zh: '保留提示词语言；使用前请核对结构并填写占位提示。' }
    ] };
  }

  globalThis.PromptUplift = Object.freeze({ analyze, optimize });
  if (typeof document === 'undefined') return;

  const COPY = {
    en: {
      skip: 'Skip to tool', navHow: 'How it works', navFaq: 'FAQ', eyebrow: 'A LITTLE STRUCTURE. A CLEARER PROMPT.',
      heading: 'Free AI Prompt Optimizer', intro: 'Turn a rough idea into a clearer prompt. Check 8 essentials, see what’s missing, and give your next prompt a little uplift.',
      privacy: '100% free · No signup · Runs in your browser, nothing uploaded',
      inputTitle: 'Your prompt', stepInput: '01 / INPUT', inputHelp: 'Paste an English or Chinese prompt to get started.',
      placeholder: 'What would you like an AI to do?\n\nFor example: Write a blog post about time management for college students.',
      example: 'Try an example', clear: 'Clear', chars: 'characters', analyze: 'Analyze prompt', shortcut: '⌘ / Ctrl + Enter to analyze',
      resultsTitle: 'Your prompt check', stepResults: '02 / ANALYSIS', emptyTitle: 'Clarity starts here.',
      emptyBody: 'Your score and 8 practical checks will appear here after you analyze a prompt.', emptyNote: 'No AI calls. Just transparent rules.',
      checklist: 'THE 8 ESSENTIALS', optimize: 'Optimize in one click', analyzeFirst: 'Analyze your prompt to unlock optimization.',
      scoreLabel: 'Structure score', scoreHigh: 'A strong starting point', scoreMid: 'A little more detail will help', scoreLow: 'Let’s give this more structure',
      scoreNote: 'A structure check, not a prediction of AI quality.',
      math: 'Score = round(points earned ÷ 92 × 100). Pass earns full weight; partial earns half; missing earns zero.',
      rulesTitle: 'How are these checks decided?',
      rulesBody: 'Checks use English/Chinese keywords and simple patterns, so they may miss valid wording or count irrelevant mentions. Task, context, audience, role, and example need explicit wording to pass; weaker clues earn partial credit. Format needs both a format and a length; constraints need both a boundary and a tone. Specific wording passes when there are no listed vague phrases and at least 20 non-space characters; one vague phrase or shorter text earns partial, while two or more vague phrases earn zero. Recognized placeholders, such as [To fill: ...] or [your background here], and templates made only of square-bracketed hints do not earn points. Always review the suggestions yourself.',
      optimizedTitle: 'Your structured prompt', stepOutput: '03 / OPTIMIZED', copy: 'Copy prompt', copied: 'Copied!',
      outputNote: 'Fill in the bracketed placeholders before using this prompt. This is a rule-based structure edit; your wording is preserved.',
      changes: 'What changed', outputLabel: 'Optimized prompt',
      howEyebrow: 'FROM ROUGH TO READY', howTitle: 'Better prompts, in three steps.',
      how1Title: 'Bring your idea.', how1Body: 'Paste a prompt in English or Chinese. A sentence, a draft, or something you already use.',
      how2Title: 'Find the gaps.', how2Body: 'Check 8 essentials, from a clear task to a useful example. Each check includes English and Chinese advice.',
      how3Title: 'Give it structure.', how3Body: 'Reorganize it into four sections, fill in the missing details, and copy it into your preferred AI tool.',
      faqEyebrow: 'A FEW GOOD QUESTIONS', faqTitle: 'Good to know.',
      faq1q: 'What does this AI prompt optimizer actually do?', faq1a: 'PromptUplift checks the structure of your prompt with local JavaScript rules. It looks for a task, context, format and length, audience, constraints and tone, a role, an example, and specific wording. It then organizes the original text into Task, Context, Format, and Constraints, with placeholders for missing details. It does not use a generative AI model.',
      faq2q: 'Is it free? Do I need an account?', faq2a: 'Yes, the tool is completely free. There is no account, subscription, API key, or usage quota. You can also use the downloaded files offline.',
      faq3q: 'Is my prompt uploaded or saved?', faq3a: 'The tool never uploads or saves your prompt. Analysis and restructuring happen in your browser’s memory. There are no analytics, external fonts, or third-party scripts. Refreshing the page resets the tool; your browser may independently restore form contents. When hosted, the hosting provider handles ordinary page requests, but the tool does not send it your prompt.',
      faq4q: 'How is the score out of 100 calculated?', faq4a: 'The eight weights are 20, 15, 15, 10, 10, 8, 8, and 6, adding up to 92. A pass earns the full weight, a partial pass earns half, and a missing item earns zero. The total is divided by 92, multiplied by 100, and rounded to the nearest whole number. The score measures signals of structure, not truth, safety, or the quality of a future AI answer.',
      faq5q: 'Does it support Chinese and work with any AI tool?', faq5a: 'It checks English and Chinese prompts. The page starts in English; the switch changes interface text only. The optimizer estimates the input’s main language from the text and keeps original wording, including mixed-language terms. You can copy the result into any AI tool that accepts text prompts; PromptUplift has no integration with those services.',
      faq6q: 'Will one-click optimization invent missing details?', faq6a: 'No. It groups your existing wording and adds clearly marked placeholders such as [To fill: target audience]. It cannot understand every nuance, resolve contradictions, or replace vague wording with facts it does not know. Review the arrangement, move any misplaced text, and fill the placeholders before use.',
      footer: 'A clearer starting point for your next idea.', footerLocal: 'Made for your browser. Your words stay yours.',
      errorEmpty: 'Paste a prompt first, then click Analyze.', errorLong: 'Please use 20,000 characters or fewer; your text has not been shortened.',
      updated: 'Prompt changed. Analyze again for an up-to-date score.', analyzed: 'Analysis complete.', optimized: 'Structured prompt ready. Review and fill the placeholders.',
      copyFailed: 'Automatic copy is unavailable. The prompt is selected; press Ctrl+C or ⌘C, or touch and hold to copy.', cleared: 'Prompt cleared.',
      statusPass: 'Pass', statusPartial: 'Partial', statusMissing: 'Missing', points: 'weight'
    },
    zh: {
      skip: '跳到工具', navHow: '使用方法', navFaq: '常见问题', eyebrow: '加一点结构，让提示词更清楚。',
      heading: '免费 AI 提示词优化器', intro: '把粗略想法整理成更清楚的提示词。检查 8 项要素，找出缺少的信息，让下一次提问更有条理。',
      privacy: '100% 免费 · 无需注册 · 在浏览器中运行，内容不上传',
      inputTitle: '你的提示词', stepInput: '01 / 输入', inputHelp: '粘贴中文或英文提示词，即可开始。',
      placeholder: '你希望 AI 帮你做什么？\n\n例如：为大学生写一篇关于时间管理的文章。',
      example: '试用示例', clear: '清空', chars: '字符', analyze: '分析提示词', shortcut: '⌘ / Ctrl + Enter 快捷分析',
      resultsTitle: '提示词检查', stepResults: '02 / 分析', emptyTitle: '清楚表达，从这里开始。',
      emptyBody: '点击分析后，这里会显示总分和 8 项具体检查结果。', emptyNote: '无需 AI 接口，规则公开透明。',
      checklist: '8 项关键要素', optimize: '一键优化', analyzeFirst: '先分析提示词，再进行结构优化。',
      scoreLabel: '结构完整度', scoreHigh: '这是一个不错的起点', scoreMid: '再补充一些细节会更好', scoreLow: '一起把结构补充完整',
      scoreNote: '仅检查结构，不预测 AI 回答质量。',
      math: '总分 = 四舍五入（已得分 ÷ 92 × 100）。通过得该项全分，部分通过得一半，缺失得零分。',
      rulesTitle: '这些检查是怎么判断的？',
      rulesBody: '通过中英文关键词和简单句式判断，可能漏掉有效表述，也可能把无关提及算作命中。任务、背景、受众、角色和示例需要明确表达才算通过，较弱线索得一半分；格式需要同时写出形式和长度；约束需要同时给出边界和语气。具体措辞在没有命中模糊词且非空白字符不少于 20 个时得全分，出现 1 个模糊词或文字更短得一半分，出现 2 个及以上得零分。可识别的占位提示（如 [待补充：...]、[your background here]），以及全部由方括号提示组成的模板不计分。请结合实际需求判断建议是否适用。',
      optimizedTitle: '整理后的提示词', stepOutput: '03 / 优化结果', copy: '复制提示词', copied: '已复制！',
      outputNote: '使用前请填写方括号中的占位提示。这是规则驱动的结构整理，原有措辞会保留。',
      changes: '本次改了什么', outputLabel: '优化后的提示词',
      howEyebrow: '从想法，到清楚的提问', howTitle: '三步，让提示词更有条理。',
      how1Title: '写下你的想法。', how1Body: '粘贴中文或英文提示词，可以是一句话、一份草稿，或你正在使用的内容。',
      how2Title: '找出信息缺口。', how2Body: '检查从任务动作到示例的 8 项关键要素，每项均提供中英文建议。',
      how3Title: '整理后再使用。', how3Body: '把内容整理为四段结构，补齐缺少的信息，再复制到你习惯使用的 AI 工具。',
      faqEyebrow: '你可能想知道', faqTitle: '常见问题。',
      faq1q: '这个 AI 提示词优化器具体能做什么？', faq1a: 'PromptUplift 通过本地 JavaScript 规则检查提示词结构，包括任务、背景、格式与长度、受众、约束与语气、角色、示例和具体措辞，再将原文整理成 Task / Context / Format / Constraints 四段，并用占位提示标出缺失信息。它不使用生成式 AI 模型。',
      faq2q: '真的免费吗？需要注册账号吗？', faq2a: '工具完全免费，不需要账号、订阅或接口密钥，也没有使用次数限制。下载页面文件后，还可以离线使用。',
      faq3q: '我的提示词会被上传或保存吗？', faq3a: '工具不会上传或保存你的提示词。分析和整理仅在浏览器内存中进行，没有访问统计、外部字体或第三方脚本。刷新会重置工具；浏览器自身可能恢复表单内容。网站上线后，托管平台会处理正常的网页访问请求，但工具不会把提示词发送给它。',
      faq4q: '100 分制的总分是怎么计算的？', faq4a: '8 项原始权重分别为 20、15、15、10、10、8、8、6，合计 92 分。通过得全分，部分通过得一半，缺失得零分。将总得分除以 92，再乘以 100，最后四舍五入取整。这个分数衡量结构线索，不代表事实准确性、安全性或未来 AI 回答的质量。',
      faq5q: '支持中文吗？能用于哪些 AI 工具？', faq5a: '支持中文和英文提示词。页面默认英文，右上角按钮只切换页面文字。优化器根据文字估计主要语言，保留原有措辞和中英混合术语。你可以将结果复制到任何接受文字提示词的 AI 工具中；本站没有连接这些服务。',
      faq6q: '一键优化会编造缺少的信息吗？', faq6a: '不会。它整理已有措辞，并添加“[待补充：目标受众]”这样的明确标记。它无法理解所有语义、消除矛盾，或替你编出模糊词背后的事实。使用前请检查段落归类，移动放错位置的内容，并填写占位提示。',
      footer: '让下一个想法，有一个更清楚的起点。', footerLocal: '为浏览器而做，你的文字由你掌握。',
      errorEmpty: '请先粘贴提示词，再点击分析。', errorLong: '请使用不超过 20,000 个字符的提示词；原文未被截短。',
      updated: '提示词已修改，请重新分析以更新结果。', analyzed: '分析完成。', optimized: '结构整理完成，请核对并填写占位提示。',
      copyFailed: '浏览器未能自动复制。已选中提示词，请按 Ctrl+C 或 ⌘C，手机上可长按复制。', cleared: '已清空提示词。',
      statusPass: '通过', statusPartial: '部分通过', statusMissing: '缺失', points: '权重'
    }
  };

  const $ = id => document.getElementById(id);
  let language = 'en';
  let analysis = null;
  let output = null;
  let noticeKey = '';
  let copyTimer;
  let revision = 0;
  const t = key => COPY[language][key];

  function notify(key, isError = false) {
    noticeKey = key;
    $('notice').textContent = key ? t(key) : '';
    $('notice').classList.toggle('error', isError);
    $('prompt').setAttribute('aria-invalid', String(isError));
  }

  function renderRules() {
    const fragment = document.createDocumentFragment();
    for (const [index, rule] of RULES.entries()) {
      const item = analysis?.items[index];
      const row = document.createElement('li');
      row.className = 'check-row';
      const head = document.createElement('div');
      head.className = 'check-head';
      const name = document.createElement('span');
      name.className = 'check-name';
      name.textContent = rule[language];
      const weight = document.createElement('span');
      weight.className = 'check-weight';
      weight.textContent = `${item ? item.points : '–'}/${rule.weight}`;
      const status = document.createElement('span');
      status.className = `check-status ${item ? ['missing', 'partial', 'pass'][item.level * 2] : 'pending'}`;
      status.textContent = item ? t(['statusMissing', 'statusPartial', 'statusPass'][item.level * 2]) : '–';
      head.append(name, weight, status);
      row.append(head);
      if (item) {
        const advice = document.createElement('p');
        advice.className = 'check-advice';
        // Never insert user content as HTML; translated suggestions are plain text too.
        for (const lang of [language, language === 'en' ? 'zh' : 'en']) {
          const line = document.createElement('span');
          line.lang = lang === 'zh' ? 'zh-CN' : 'en';
          line.textContent = item.advice[lang];
          advice.append(line);
        }
        row.append(advice);
      }
      fragment.append(row);
    }
    $('checks').replaceChildren(fragment);
  }

  function renderResult() {
    $('empty-state').hidden = Boolean(analysis);
    $('score-panel').hidden = !analysis;
    $('optimize').disabled = !analysis;
    $('analyze-first').hidden = Boolean(analysis);
    if (analysis) {
      $('score').textContent = analysis.score;
      $('score-meter').setAttribute('aria-valuenow', analysis.score);
      $('score-meter').style.setProperty('--score', analysis.score);
      $('score-summary').textContent = t(analysis.score >= 80 ? 'scoreHigh' : analysis.score >= 40 ? 'scoreMid' : 'scoreLow');
      $('raw-score').textContent = `${analysis.raw} / 92`;
    }
    renderRules();
    $('output-section').hidden = !output;
    if (output) {
      const nodes = output.changes.map(change => {
        const li = document.createElement('li');
        li.textContent = change[language];
        return li;
      });
      $('changes').replaceChildren(...nodes);
    }
  }

  function updateCount() {
    $('character-count').textContent = `${$('prompt').value.length.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')} / 20,000 ${t('chars')}`;
  }

  function setLanguage(next) {
    language = next;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
    $('prompt').placeholder = t('placeholder');
    $('optimized-prompt').setAttribute('aria-label', t('outputLabel'));
    $('score-meter').setAttribute('aria-label', t('scoreLabel'));
    $('language-toggle').textContent = language === 'en' ? '中文' : 'English';
    $('language-toggle').setAttribute('aria-label', language === 'en' ? '切换到中文' : 'Switch to English');
    $('language-toggle').lang = language === 'en' ? 'zh-CN' : 'en';
    clearTimeout(copyTimer);
    updateCount();
    renderResult();
    if (noticeKey) $('notice').textContent = t(noticeKey);
  }

  function invalidate() {
    const hadResult = Boolean(analysis);
    revision++;
    analysis = null;
    output = null;
    $('optimized-prompt').value = '';
    clearTimeout(copyTimer);
    $('copy').textContent = t('copy');
    notify(hadResult ? 'updated' : '');
    updateCount();
    renderResult();
  }

  function runAnalysis(event) {
    event?.preventDefault();
    const value = $('prompt').value;
    if (!value.trim() || value.length > MAX_LENGTH) {
      notify(value.length > MAX_LENGTH ? 'errorLong' : 'errorEmpty', true);
      $('prompt').focus();
      return;
    }
    revision++;
    analysis = analyze(value);
    output = null;
    $('optimized-prompt').value = '';
    renderResult();
    notify('analyzed');
  }

  function fallbackCopy() {
    const active = document.activeElement;
    const element = $('optimized-prompt');
    element.focus({ preventScroll: true });
    element.select();
    element.setSelectionRange(0, element.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { /* Manual selection remains available. */ }
    if (copied) active?.focus({ preventScroll: true });
    return copied;
  }

  $('prompt-form').addEventListener('submit', runAnalysis);
  $('prompt').addEventListener('input', invalidate);
  $('prompt').addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) runAnalysis(event);
  });
  $('language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en'));
  $('clear').addEventListener('click', () => {
    $('prompt').value = '';
    invalidate();
    notify('cleared');
    $('prompt').focus();
  });
  $('example').addEventListener('click', () => {
    $('prompt').value = language === 'en'
      ? 'Write a 200-word blog post in Markdown about time management for college students. Use a friendly tone.'
      : '为大学生写一篇关于时间管理的文章。格式：Markdown，长度为200字。语气：亲切。';
    invalidate();
    $('prompt').focus();
  });
  $('optimize').addEventListener('click', () => {
    if (!analysis) return;
    revision++;
    output = optimize($('prompt').value);
    $('optimized-prompt').value = output.text;
    $('optimized-prompt').lang = output.language === 'zh' ? 'zh-CN' : 'en';
    $('copy').textContent = t('copy');
    renderResult();
    notify('optimized');
    $('output-section').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    $('output-title').focus({ preventScroll: true });
  });
  $('copy').addEventListener('click', async () => {
    if (!output) return;
    const currentRevision = revision;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(output.text);
        copied = true;
      }
    } catch (_) { /* Try the local-file-compatible copy operation below. */ }
    if (revision !== currentRevision) return;
    if (!copied) copied = fallbackCopy();
    if (copied) {
      $('copy').textContent = t('copied');
      notify('copied');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { $('copy').textContent = t('copy'); }, 2200);
    } else notify('copyFailed');
  });

  // Do not persist prompts or language choices. Always start the UI in English.
  setLanguage('en');
})();
