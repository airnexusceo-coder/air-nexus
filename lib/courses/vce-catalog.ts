import type { NexusPlan } from '@/lib/plans'

export type VceCourseCategory =
  | 'English'
  | 'Mathematics'
  | 'Science'
  | 'Humanities'
  | 'Business'
  | 'Health and PE'
  | 'Technology'
  | 'Arts'
  | 'Languages'

export type VceKeyKnowledgePoint = {
  label: string
  detail: string
  explanation: string
  vceExample: string
  misconception: string
  checkQuestion: string
  answerGuide: string
}

export type VceCommandTerm = {
  term: string
  meaning: string
  responseMove: string
}

export type VceCourseLesson = {
  id: string
  title: string
  objective: string
  studyDesignFocus: string
  keyKnowledge: VceKeyKnowledgePoint[]
  commandTerms: VceCommandTerm[]
  practice: string[]
}

export type VceCourseChapter = {
  id: string
  title: string
  outcome: string
  studyDesignFocus: string
  lessons: VceCourseLesson[]
}

export type VceCourseLevel = {
  unit: 1 | 2 | 3 | 4
  title: string
  focus: string
  chapters: VceCourseChapter[]
}

export type VceCourseStudyDesign = {
  sourceUrl: string
  keyKnowledge: VceKeyKnowledgePoint[]
  commandTerms: VceCommandTerm[]
}

export type VceCourse = {
  id: string
  name: string
  category: VceCourseCategory
  description: string
  studyDesign: VceCourseStudyDesign
  levels: VceCourseLevel[]
}

export type CourseAccessSelection = {
  freeSubjectId: string | null
  plusMonthKey: string | null
  plusCourseId: string | null
  plusUnit: 1 | 2 | 3 | 4 | null
}

export type CourseAccessReason = 'premium' | 'free-subject' | 'plus-monthly-unit' | 'locked'

export type CourseAccessResult = {
  unlocked: boolean
  reason: CourseAccessReason
  requiredPlan: Exclude<NexusPlan, 'Free'> | null
}

export const VCE_STUDY_DESIGN_SOURCE = {
  label: 'VCAA VCE Study Designs',
  url: 'https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs/vce-study-designs',
}
const VCAA_SUBJECT_PAGE_BASE = 'https://www.vcaa.vic.edu.au/curriculum/vce-curriculum/vce-study-designs'

const VCAA_SUBJECT_PAGE_URLS: Record<string, string> = {
  'bridging-english-eal': `${VCAA_SUBJECT_PAGE_BASE}/bridging-english-additional-language/bridging-english-additional-language-eal`,
  'foundation-english': `${VCAA_SUBJECT_PAGE_BASE}/foundation-english/foundation-english`,
  'vce-vm-literacy': `${VCAA_SUBJECT_PAGE_BASE}/vce-vm-literacy/vce-vocational-major-literacy`,
  'vce-vm-numeracy': `${VCAA_SUBJECT_PAGE_BASE}/vce-vm-numeracy/vce-vocational-major-numeracy`,
  'classical-studies': `${VCAA_SUBJECT_PAGE_BASE}/classical-studies/classical-studies`,
  'religion-society': `${VCAA_SUBJECT_PAGE_BASE}/religion-and-society/vce-religion-and-society`,
  'texts-traditions': `${VCAA_SUBJECT_PAGE_BASE}/texts-and-traditions/vce-texts-and-traditions`,
  'industry-enterprise': `${VCAA_SUBJECT_PAGE_BASE}/industry-and-enterprise/industry-and-enterprise`,
  'vce-vm-work-related-skills': `${VCAA_SUBJECT_PAGE_BASE}/vce-vm-work-related-skills/vce-vocational-major-work-related-skills`,
  'vce-vm-personal-development-skills': `${VCAA_SUBJECT_PAGE_BASE}/vce-vm-personal-development-skills/vce-vocational-major-personal-development-skills`,
  algorithmics: `${VCAA_SUBJECT_PAGE_BASE}/algorithms-hess/vce-algorithmics-hess`,
  'agricultural-horticultural-studies': `${VCAA_SUBJECT_PAGE_BASE}/agricultural-and-horticultural-studies/agricultural-and-horticultural-studies`,
  dance: `${VCAA_SUBJECT_PAGE_BASE}/dance/dance`,
  music: `${VCAA_SUBJECT_PAGE_BASE}/music/music`,
  'extended-investigation': `${VCAA_SUBJECT_PAGE_BASE}/extended-investigation/extended-investigation`,  english: `${VCAA_SUBJECT_PAGE_BASE}/english-and-english-additional-language/english-and-english-additional-language-eal`,
  'english-eal': `${VCAA_SUBJECT_PAGE_BASE}/english-and-english-additional-language/english-and-english-additional-language-eal`,
  'english-language': `${VCAA_SUBJECT_PAGE_BASE}/english-language/english-language`,
  literature: `${VCAA_SUBJECT_PAGE_BASE}/literature/vce-literature`,
  'foundation-mathematics': `${VCAA_SUBJECT_PAGE_BASE}/foundation-mathematics/vce-foundation-mathematics`,
  'general-mathematics': `${VCAA_SUBJECT_PAGE_BASE}/general-mathematics/vce-general-mathematics`,
  'mathematical-methods': `${VCAA_SUBJECT_PAGE_BASE}/mathematical-methods/vce-mathematical-methods`,
  'specialist-mathematics': `${VCAA_SUBJECT_PAGE_BASE}/specialist-mathematics/vce-specialist-mathematics`,
  biology: `${VCAA_SUBJECT_PAGE_BASE}/biology/biology`,
  chemistry: `${VCAA_SUBJECT_PAGE_BASE}/chemistry/chemistry`,
  physics: `${VCAA_SUBJECT_PAGE_BASE}/physics/physics`,
  psychology: `${VCAA_SUBJECT_PAGE_BASE}/psychology/vce-psychology`,
  'environmental-science': `${VCAA_SUBJECT_PAGE_BASE}/environmental-science/environmental-science`,
  geography: `${VCAA_SUBJECT_PAGE_BASE}/geography/geography`,
  'history-ancient': `${VCAA_SUBJECT_PAGE_BASE}/history-ancient/history`,
  'history-australian': `${VCAA_SUBJECT_PAGE_BASE}/history-ancient/history`,
  'history-revolutions': `${VCAA_SUBJECT_PAGE_BASE}/history-ancient/history`,
  philosophy: `${VCAA_SUBJECT_PAGE_BASE}/philosophy/philosophy`,
  sociology: `${VCAA_SUBJECT_PAGE_BASE}/sociology/sociology`,
  politics: `${VCAA_SUBJECT_PAGE_BASE}/politics/vce-politics`,
  accounting: `${VCAA_SUBJECT_PAGE_BASE}/accounting/accounting`,
  'business-management': `${VCAA_SUBJECT_PAGE_BASE}/business-management/vce-business-management`,
  economics: `${VCAA_SUBJECT_PAGE_BASE}/economics/vce-economics`,
  'legal-studies': `${VCAA_SUBJECT_PAGE_BASE}/legal-studies/legal-studies`,
  'health-human-development': `${VCAA_SUBJECT_PAGE_BASE}/health-and-human-development/health-and-human-development`,
  'physical-education': `${VCAA_SUBJECT_PAGE_BASE}/physical-education/physical-education`,
  'outdoor-environmental-studies': `${VCAA_SUBJECT_PAGE_BASE}/outdoor-and-environmental-studies/outdoor-and-environmental-studies`,
  'applied-computing': `${VCAA_SUBJECT_PAGE_BASE}/applied-computing-data-analytics/applied-computing`,
  'data-analytics': `${VCAA_SUBJECT_PAGE_BASE}/applied-computing-data-analytics/applied-computing`,
  'software-development': `${VCAA_SUBJECT_PAGE_BASE}/applied-computing-data-analytics/applied-computing`,
  'product-design-technology': `${VCAA_SUBJECT_PAGE_BASE}/product-design-and-technologies/product-design-and-technologies`,
  'systems-engineering': `${VCAA_SUBJECT_PAGE_BASE}/system-engineering/systems-engineering`,
  'food-studies': `${VCAA_SUBJECT_PAGE_BASE}/food-studies/vce-food-studies`,
  media: `${VCAA_SUBJECT_PAGE_BASE}/media/media`,
  'visual-communication-design': `${VCAA_SUBJECT_PAGE_BASE}/visual-communication-design/visual-communication-design`,
  'art-creative-practice': `${VCAA_SUBJECT_PAGE_BASE}/art-creative-practice/vce-art-creative-practice`,
  'art-making-exhibiting': `${VCAA_SUBJECT_PAGE_BASE}/art-making-and-exhibiting/vce-art-making-and-exhibiting`,
  drama: `${VCAA_SUBJECT_PAGE_BASE}/drama/drama`,
  'theatre-studies': `${VCAA_SUBJECT_PAGE_BASE}/theatre-studies/vce-theatre-studies-study-design`,
  french: `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
  german: `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
  italian: `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
  'japanese-second-language': `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
  'chinese-second-language': `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
  spanish: `${VCAA_SUBJECT_PAGE_BASE}/vce-study-designs-languages`,
}

function studyDesignSourceUrlFor(id: string) {
  return VCAA_SUBJECT_PAGE_URLS[id] ?? VCE_STUDY_DESIGN_SOURCE.url
}

type LessonTheme = {
  title: string
  studyDesignFocus: string
  objective: string
  practice: (courseName: string, topicPhrase: string, skillPhrase: string) => string[]
}

type ChapterTheme = {
  title: string
  outcome: string
  studyDesignFocus: string
  lessons: LessonTheme[]
}

type UnitBlueprint = {
  unit: 1 | 2 | 3 | 4
  title: string
  focus: string
  chapters: ChapterTheme[]
}

const FOUNDATION_LESSONS: LessonTheme[] = [
  {
    title: 'Outcome map',
    studyDesignFocus: 'Outcome statement, key knowledge and key skills',
    objective: 'Translate the study design outcome into a clear lesson checklist.',
    practice: (courseName, topicPhrase) => [
      `Identify the outcome verbs students must prove in ${courseName}.`,
      `Group ${topicPhrase} into must-know knowledge and must-do skills.`,
      'Create a short success checklist for this chapter.',
    ],
  },
  {
    title: 'Key knowledge builder',
    studyDesignFocus: 'Required concepts, terminology and relationships',
    objective: 'Build the core concept map before using textbook or teacher notes.',
    practice: (courseName, topicPhrase) => [
      `Define the central ${courseName} terms from the study design language.`,
      `Link each term to ${topicPhrase}.`,
      'Mark unknown terms for later book/key concept imports.',
    ],
  },
  {
    title: 'First applied examples',
    studyDesignFocus: 'Application of required knowledge',
    objective: 'Use small examples to show that the key knowledge can be applied.',
    practice: (courseName, topicPhrase, skillPhrase) => [
      `Work through one simple ${courseName} example connected to ${topicPhrase}.`,
      `Explain the example using ${skillPhrase}.`,
      'Write one checkpoint question in study-design language.',
    ],
  },
]

const SKILL_LESSONS: LessonTheme[] = [
  {
    title: 'Key skills workshop',
    studyDesignFocus: 'Required skills and command terms',
    objective: 'Practise the actions the study design expects students to demonstrate.',
    practice: (courseName, _topicPhrase, skillPhrase) => [
      `Turn ${skillPhrase} into three visible student actions.`,
      `Annotate one ${courseName} response for evidence of those actions.`,
      'Create a mini-rubric for a teacher-checkable response.',
    ],
  },
  {
    title: 'Outcome task rehearsal',
    studyDesignFocus: 'Outcome evidence and classroom assessment',
    objective: 'Prepare for the kind of evidence a SAC or school task can require.',
    practice: (courseName, topicPhrase) => [
      `Draft a short task using ${topicPhrase}.`,
      `List what a complete ${courseName} answer must include.`,
      'Separate content errors from skill errors for feedback.',
    ],
  },
  {
    title: 'Transfer practice',
    studyDesignFocus: 'Applying knowledge in unfamiliar contexts',
    objective: 'Move beyond recall by applying the same outcome to a new situation.',
    practice: (courseName, topicPhrase, skillPhrase) => [
      `Change one condition in a ${courseName} example and re-answer it.`,
      `Use ${skillPhrase} to justify the new response.`,
      `Write a reflection on which part of ${topicPhrase} was hardest to transfer.`,
    ],
  },
]

const ASSESSMENT_LESSONS: LessonTheme[] = [
  {
    title: 'Assessment evidence planner',
    studyDesignFocus: 'Assessment, outcome evidence and satisfactory completion',
    objective: 'Connect lessons to the evidence students need for the outcome.',
    practice: (courseName, topicPhrase) => [
      `Match each ${courseName} lesson to likely evidence from ${topicPhrase}.`,
      'Flag which evidence is recall, application, analysis or evaluation.',
      'Build a one-page pre-SAC checklist.',
    ],
  },
  {
    title: 'Common error clinic',
    studyDesignFocus: 'Misconceptions, missing skills and incomplete evidence',
    objective: 'Find the weak points before they appear in assessment.',
    practice: (courseName, topicPhrase) => [
      `List three ways students can misunderstand ${topicPhrase}.`,
      `Rewrite one incomplete ${courseName} answer into a complete one.`,
      'Create one feedback target for the next lesson.',
    ],
  },
  {
    title: 'Chapter checkpoint',
    studyDesignFocus: 'Outcome readiness and revision evidence',
    objective: 'Finish the chapter with a checkpoint tied directly to the study design.',
    practice: (courseName, _topicPhrase, skillPhrase) => [
      `Answer one short ${courseName} checkpoint under light time pressure.`,
      `Highlight where the answer shows ${skillPhrase}.`,
      'Decide whether the chapter is ready, needs practice or needs reteaching.',
    ],
  },
]

const UNIT_BLUEPRINTS: UnitBlueprint[] = [
  {
    unit: 1,
    title: 'Unit 1',
    focus: 'Study-design foundations, first outcomes, key terms and early evidence of skills.',
    chapters: [
      {
        title: 'Area of Study 1 - Foundations and concepts',
        outcome: 'Outcome 1: establish the first required knowledge base for the unit.',
        studyDesignFocus: 'Key knowledge, core terminology and foundational relationships',
        lessons: FOUNDATION_LESSONS,
      },
      {
        title: 'Area of Study 2 - Application and analysis',
        outcome: 'Outcome 2: apply the unit knowledge through the required study-design skills.',
        studyDesignFocus: 'Key skills, application and interpretation',
        lessons: SKILL_LESSONS,
      },
      {
        title: 'Assessment chapter - Evidence and reflection',
        outcome: 'Outcome evidence: prepare for school-based assessment and satisfactory completion.',
        studyDesignFocus: 'Assessment evidence, feedback and revision readiness',
        lessons: ASSESSMENT_LESSONS,
      },
    ],
  },
  {
    unit: 2,
    title: 'Unit 2',
    focus: 'Second-semester outcomes, broader applications, investigation and stronger skill transfer.',
    chapters: [
      {
        title: 'Area of Study 1 - Extended knowledge',
        outcome: 'Outcome 1: extend the study-design knowledge into a new context or problem type.',
        studyDesignFocus: 'Expanded key knowledge and links between ideas',
        lessons: FOUNDATION_LESSONS,
      },
      {
        title: 'Area of Study 2 - Investigation and communication',
        outcome: 'Outcome 2: investigate, communicate and justify using the required methods.',
        studyDesignFocus: 'Investigation, communication and evidence-based reasoning',
        lessons: SKILL_LESSONS,
      },
      {
        title: 'Assessment chapter - Unit 2 outcome proof',
        outcome: 'Outcome evidence: show readiness for later Units 3 and 4 expectations.',
        studyDesignFocus: 'SAC preparation, evidence quality and skill consolidation',
        lessons: ASSESSMENT_LESSONS,
      },
    ],
  },
  {
    unit: 3,
    title: 'Unit 3',
    focus: 'Scored study core, outcome language, SAC evidence and exam-standard responses.',
    chapters: [
      {
        title: 'Area of Study 1 - Scored core knowledge',
        outcome: 'Outcome 1: develop the first scored-study knowledge and skills sequence.',
        studyDesignFocus: 'High-yield key knowledge and examinable relationships',
        lessons: FOUNDATION_LESSONS,
      },
      {
        title: 'Area of Study 2 - SAC response skills',
        outcome: 'Outcome 2: demonstrate required skills in school-assessed coursework.',
        studyDesignFocus: 'Command terms, response structure and applied reasoning',
        lessons: SKILL_LESSONS,
      },
      {
        title: 'Assessment chapter - Scored evidence',
        outcome: 'Outcome evidence: convert study-design requirements into SAC and exam practice.',
        studyDesignFocus: 'SAC evidence, marking cues and exam transfer',
        lessons: ASSESSMENT_LESSONS,
      },
    ],
  },
  {
    unit: 4,
    title: 'Unit 4',
    focus: 'Final outcomes, synthesis across the study design, targeted revision and exam readiness.',
    chapters: [
      {
        title: 'Area of Study 1 - Final knowledge sequence',
        outcome: 'Outcome 1: master the final required knowledge set for the study.',
        studyDesignFocus: 'Final key knowledge, links to Unit 3 and conceptual synthesis',
        lessons: FOUNDATION_LESSONS,
      },
      {
        title: 'Area of Study 2 - Synthesis and evaluation',
        outcome: 'Outcome 2: combine knowledge and skills across multiple study-design contexts.',
        studyDesignFocus: 'Synthesis, evaluation, interpretation and justified conclusions',
        lessons: SKILL_LESSONS,
      },
      {
        title: 'Assessment chapter - Exam readiness',
        outcome: 'Outcome evidence: finish with targeted revision and exam-standard proof.',
        studyDesignFocus: 'Timed practice, error analysis and exam response quality',
        lessons: ASSESSMENT_LESSONS,
      },
    ],
  },
]

const CATEGORY_COMMAND_TERMS: Record<VceCourseCategory, VceCommandTerm[]> = {
  English: [
    { term: 'Analyse', meaning: 'Break the text, language or argument into parts and explain how those parts create meaning.', responseMove: 'Name the technique, quote/select evidence, explain the effect and link to purpose.' },
    { term: 'Compare', meaning: 'Show meaningful similarities and differences between texts, ideas or arguments.', responseMove: 'Use paired evidence and explain what the comparison reveals.' },
    { term: 'Discuss', meaning: 'Develop a balanced interpretation using evidence and reasoning.', responseMove: 'Make a clear contention, test more than one idea and return to the prompt.' },
    { term: 'Evaluate', meaning: 'Judge effectiveness, value or impact using criteria.', responseMove: 'State the criteria, weigh evidence and explain the final judgement.' },
    { term: 'Create', meaning: 'Compose original writing shaped by purpose, audience, context and form.', responseMove: 'Use deliberate language choices and explain the craft decisions when needed.' },
  ],
  Mathematics: [
    { term: 'Determine', meaning: 'Find a value, rule or result using appropriate mathematical methods.', responseMove: 'Show the method, give the exact or rounded answer and include units where relevant.' },
    { term: 'Solve', meaning: 'Work through an equation, problem or condition to find all valid solutions.', responseMove: 'Set up the relationship, apply algebra/technology and reject invalid answers.' },
    { term: 'Sketch', meaning: 'Draw the important features of a graph or diagram without needing exact scale.', responseMove: 'Label intercepts, asymptotes, turning points, endpoints and domain/range features.' },
    { term: 'Explain', meaning: 'Use mathematical reasoning to make a result or method clear.', responseMove: 'Connect each step to a theorem, property, graph feature or model assumption.' },
    { term: 'Interpret', meaning: 'Translate a mathematical result into the context of the problem.', responseMove: 'State what the value means and comment on reasonableness or limitations.' },
  ],
  Science: [
    { term: 'Describe', meaning: 'Give the relevant features, observations or sequence of events.', responseMove: 'Use correct scientific terms and include the important conditions.' },
    { term: 'Explain', meaning: 'Show how or why something occurs using scientific models and evidence.', responseMove: 'Link cause, mechanism and result with precise terminology.' },
    { term: 'Analyse', meaning: 'Use data, evidence or relationships to identify patterns and implications.', responseMove: 'Refer to trends, anomalies, variables and scientific meaning.' },
    { term: 'Evaluate', meaning: 'Judge a method, claim or conclusion using evidence and limitations.', responseMove: 'Weigh strengths, weaknesses, uncertainty and validity.' },
    { term: 'Investigate', meaning: 'Plan or carry out a scientific inquiry into a question or relationship.', responseMove: 'State variables, method, data collection, controls and safety/ethics.' },
  ],
  Humanities: [
    { term: 'Identify', meaning: 'Recognise and name a feature, source idea, factor or concept.', responseMove: 'Give a precise answer and avoid extra unsupported explanation.' },
    { term: 'Explain', meaning: 'Show causes, effects or relationships between people, places, ideas or events.', responseMove: 'Use because/how language and support the link with evidence.' },
    { term: 'Analyse', meaning: 'Break evidence or concepts into parts to show patterns, motives or significance.', responseMove: 'Use specific source details and explain what they reveal.' },
    { term: 'Evaluate', meaning: 'Make a judgement about significance, reliability, effectiveness or impact.', responseMove: 'Use criteria, compare evidence and state a defensible judgement.' },
    { term: 'Justify', meaning: 'Support a position with evidence and reasoning.', responseMove: 'Make the claim explicit, select evidence and show why it proves the point.' },
  ],
  Business: [
    { term: 'Define', meaning: 'Give the precise meaning of a business, economics or legal term.', responseMove: 'Use a short formal definition and include essential features.' },
    { term: 'Explain', meaning: 'Show how a concept, process, law or strategy works.', responseMove: 'Use cause-and-effect language and link to the case or scenario.' },
    { term: 'Analyse', meaning: 'Break down a scenario to show relationships, effects or stakeholder consequences.', responseMove: 'Use case facts and explain multiple impacts.' },
    { term: 'Evaluate', meaning: 'Judge the effectiveness or suitability of an option.', responseMove: 'Use advantages, disadvantages, criteria and a final recommendation.' },
    { term: 'Recommend', meaning: 'Propose a course of action based on evidence.', responseMove: 'State the option, justify it and address at least one trade-off.' },
  ],
  'Health and PE': [
    { term: 'Describe', meaning: 'State the relevant features of a health, wellbeing, movement or environment concept.', responseMove: 'Use accurate terminology and include the specific population, context or body system.' },
    { term: 'Explain', meaning: 'Show how one factor influences an outcome.', responseMove: 'Link factor, mechanism and effect with evidence.' },
    { term: 'Analyse', meaning: 'Use data or scenario information to show patterns, causes or consequences.', responseMove: 'Refer to evidence and explain what it means for performance or health.' },
    { term: 'Evaluate', meaning: 'Judge a program, strategy or claim using criteria and evidence.', responseMove: 'Discuss strengths, limitations and the final judgement.' },
    { term: 'Apply', meaning: 'Use a concept in a particular scenario.', responseMove: 'Name the concept, connect it to scenario facts and explain the result.' },
  ],
  Technology: [
    { term: 'Investigate', meaning: 'Research needs, constraints, data, materials, systems or users.', responseMove: 'Gather relevant evidence and turn it into design or project requirements.' },
    { term: 'Design', meaning: 'Create a solution, model or process that responds to a need.', responseMove: 'Show criteria, constraints, alternatives and selected features.' },
    { term: 'Develop', meaning: 'Produce or build a working solution, system or product.', responseMove: 'Document tools, steps, decisions and iterations.' },
    { term: 'Test', meaning: 'Check whether a solution works against requirements.', responseMove: 'Use test data/criteria, record results and identify fixes.' },
    { term: 'Evaluate', meaning: 'Judge how well a solution meets criteria and user needs.', responseMove: 'Use evidence, limitations and improvement recommendations.' },
  ],
  Arts: [
    { term: 'Analyse', meaning: 'Break down artworks, performances, media products or designs to explain how meaning is made.', responseMove: 'Use specific features, conventions and evidence.' },
    { term: 'Interpret', meaning: 'Explain possible meanings, ideas or effects.', responseMove: 'Connect features to context, audience and intention.' },
    { term: 'Develop', meaning: 'Progress ideas through experimentation and refinement.', responseMove: 'Show trials, feedback, changes and intention.' },
    { term: 'Present', meaning: 'Communicate a resolved creative work or performance to an audience.', responseMove: 'Make production choices clear and control the conventions of the form.' },
    { term: 'Evaluate', meaning: 'Judge effectiveness of creative decisions or final work.', responseMove: 'Use criteria, audience impact, intent and evidence from the process.' },
  ],
  Languages: [
    { term: 'Identify', meaning: 'Locate information, ideas or language features in spoken or written texts.', responseMove: 'Select precise details and avoid adding unsupported inference.' },
    { term: 'Interpret', meaning: 'Explain meaning from language, tone, context and cultural cues.', responseMove: 'Use evidence from the text and explain the implied meaning.' },
    { term: 'Respond', meaning: 'Communicate appropriately in the target language.', responseMove: 'Address audience, purpose and register with accurate vocabulary and structures.' },
    { term: 'Compare', meaning: 'Show similarities and differences between cultures, texts or language use.', responseMove: 'Use specific examples and explain the cultural or communicative significance.' },
    { term: 'Create', meaning: 'Produce original spoken or written language for a purpose.', responseMove: 'Control text type, register, grammar and vocabulary.' },
  ],
}

const SUBJECT_KEY_KNOWLEDGE: Record<string, string[]> = {
  english: ['reading and viewing texts for ideas, values and perspectives', 'text structures, narrative features, language choices and evidence', 'crafting analytical, creative and persuasive responses for audience and purpose', 'argument, contention, tone, visual language and persuasive strategies', 'planning, drafting, editing and reflecting on writing decisions'],
  'english-language': ['language subsystems including phonology, morphology, syntax, semantics and discourse', 'metalanguage for analysing spoken and written Australian English', 'language variation by context, purpose, identity and social group', 'formal and informal language choices and their social effects', 'language change, attitudes and contemporary Australian usage'],
  literature: ['close analysis of language, form, structure and literary devices', 'interpretations shaped by context, perspective and reader response', 'adaptation, transformation and intertextual relationships', 'literary criticism, viewpoints and evidence-based argument', 'creative and analytical responses to texts'],
  'english-eal': ['listening, speaking, reading and viewing strategies for English texts', 'text response using evidence, ideas and vocabulary', 'argument analysis including contention, audience and persuasive language', 'oral presentation and communication for context and purpose', 'language development, editing and control of written expression'],

  'foundation-mathematics': ['number, measurement and financial calculations in practical contexts', 'data displays, interpretation and everyday statistics', 'shape, space, location and scale in applied problems', 'use of technology to calculate, represent and check results', 'communicating mathematical reasoning clearly in context'],
  'general-mathematics': ['data analysis, statistics and interpretation of variation', 'recursion, financial modelling and sequences', 'matrices, networks and decision mathematics', 'measurement, geometry, graphs and relations in applications', 'technology-assisted modelling and communication'],
  'mathematical-methods': ['functions, relations, transformations and graph behaviour', 'algebra, equations, calculus and rates of change', 'probability, random variables and distributions', 'mathematical modelling using exact and technology-based methods', 'reasoning with domain, range, parameters and interpretation'],
  'specialist-mathematics': ['proof, logic, algebra and advanced functions', 'vectors, complex numbers and geometry', 'calculus, differential equations and kinematics', 'mechanics, forces and motion modelling', 'advanced probability, statistics and technology-supported reasoning'],

  biology: ['cell structure, function, membranes and biochemical processes', 'systems, regulation, homeostasis and organism responses', 'genetics, inheritance, variation and molecular biology', 'evolution, selection, immunity and biological change', 'experimental design, data analysis and bioethical considerations'],
  chemistry: ['atomic structure, bonding, properties and periodic relationships', 'chemical reactions, stoichiometry, energy and rates', 'equilibrium, acids and bases, redox and electrochemistry', 'organic chemistry, fuels, polymers and analytical techniques', 'experimental design, data quality, safety and sustainability'],
  physics: ['motion, forces, energy, momentum and fields', 'electricity, circuits, magnetism and electromagnetic effects', 'waves, light, matter and quantum ideas', 'models, measurement, uncertainty and data interpretation', 'applying physics to technologies and real-world systems'],
  psychology: ['nervous system, brain function and biological bases of behaviour', 'learning, memory, consciousness and mental processes', 'mental wellbeing, stress, sleep and psychological models', 'research methods, ethics, data and scientific evidence', 'interactions between biological, psychological and social factors'],
  'environmental-science': ['ecosystems, biodiversity, energy flows and population change', 'human impacts, pollution, climate and sustainability', 'resource management, conservation and environmental decision-making', 'fieldwork methods, sampling, data and uncertainty', 'environmental risk, ethics and evidence-based action'],

  geography: ['place, spatial distribution, scale and geographic concepts', 'fieldwork, data collection, mapping and geospatial representations', 'land use, environmental change and human-environment interactions', 'population, development, resources and global patterns', 'geographic inquiry, evidence and explanation'],
  'history-ancient': ['ancient societies, power, belief systems and social structures', 'primary and secondary source evidence and interpretation', 'change, continuity, cause and consequence in ancient contexts', 'historical perspectives, significance and contested views', 'constructing arguments from evidence'],
  'history-australian': ['Australian social, political and cultural change over time', 'identity, conflict, reform and national narratives', 'source analysis, historical perspectives and evidence', 'cause, consequence, continuity and change', 'historical argument and interpretation'],
  'history-revolutions': ['causes of revolution including ideas, leaders, crises and movements', 'revolutionary events, turning points and consequences', 'experiences of groups and individuals during revolutionary change', 'historical interpretations, evidence and contestability', 'significance, continuity and change after revolution'],
  philosophy: ['logic, reasoning, arguments and fallacies', 'epistemology, metaphysics, ethics and political philosophy', 'close reading of philosophical texts and positions', 'evaluating arguments, objections and replies', 'constructing clear philosophical responses'],
  sociology: ['culture, identity, socialisation and community', 'deviance, power, social categories and institutions', 'research methods, data and ethical considerations', 'social change, inequality and contemporary issues', 'using sociological concepts to explain evidence'],
  politics: ['power, democracy, political actors and institutions', 'policy, global cooperation, conflict and international relations', 'political ideologies, values and decision-making', 'case studies, evidence and competing perspectives', 'evaluating political systems, actions and outcomes'],

  accounting: ['financial records, source documents and accounting principles', 'reports, budgeting and analysis of business performance', 'inventory, balance day adjustments and decision-making', 'ethics, qualitative characteristics and owner/stakeholder needs', 'interpreting accounting information for advice'],
  'business-management': ['business objectives, stakeholders, operations and management styles', 'human resource management, motivation and corporate culture', 'operations management, efficiency, quality and technology', 'change management, leadership and business strategy', 'case study analysis and evaluation of management decisions'],
  economics: ['markets, demand, supply, efficiency and market failure', 'macroeconomic goals including growth, inflation, employment and external stability', 'government policy, budgets, monetary policy and living standards', 'international trade, globalisation and economic relationships', 'using data to analyse economic performance and decisions'],
  'legal-studies': ['legal foundations, rights, justice and rule of law', 'criminal and civil law processes and institutions', 'law-making by parliament and courts', 'reform, access to justice and evaluation of legal systems', 'case facts, legal principles and evidence-based conclusions'],

  'health-human-development': ['health, wellbeing and development concepts and indicators', 'factors influencing health at individual, community and global levels', 'nutrition, youth health, health promotion and prevention', 'global health, sustainability, equity and human development', 'data interpretation, policy and program evaluation'],
  'physical-education': ['body systems, acute responses and chronic adaptations to exercise', 'biomechanics, skill acquisition and movement analysis', 'energy systems, fatigue, recovery and training principles', 'fitness testing, data analysis and performance improvement', 'ethical and sociocultural factors in sport and physical activity'],
  'outdoor-environmental-studies': ['relationships between people and outdoor environments', 'environmental change, sustainability and conservation', 'outdoor experiences, risk, safety and minimal impact practices', 'Indigenous perspectives and environmental management', 'evidence, data and evaluation of outdoor practices'],

  'applied-computing': ['data, information, digital systems and networks', 'programming concepts, algorithms and problem-solving methods', 'cybersecurity, privacy, ethics and impacts of digital solutions', 'project management, design and evaluation processes', 'testing, documentation and user-centred solution development'],
  'data-analytics': ['data collection, preparation, integrity and security', 'database design, data manipulation and visualisation', 'analysis methods, patterns, trends and decision support', 'project management, SAT processes and evaluation criteria', 'ethical, legal and privacy issues in data use'],
  'software-development': ['software design, algorithms, data structures and programming', 'development models, project plans and user requirements', 'testing, debugging, validation and documentation', 'security, efficiency, usability and maintainability', 'SAT solution development and evaluation'],
  'product-design-technology': ['design briefs, user needs, criteria and constraints', 'materials, production processes and sustainability', 'research, ideation, prototyping and testing', 'risk, safety, quality and production planning', 'evaluation of product effectiveness and design decisions'],
  'systems-engineering': ['mechanical and electrotechnological systems, inputs and outputs', 'systems design, control, energy and efficiency', 'modelling, construction, testing and fault finding', 'project management, safety and risk assessment', 'evaluation against criteria and system performance'],
  'food-studies': ['food systems, production, processing and sustainability', 'nutrition, digestion, health and food choice', 'food safety, preparation techniques and sensory properties', 'culture, ethics, marketing and consumer behaviour', 'investigating and evaluating food solutions'],

  media: ['media forms, codes, conventions and narrative structures', 'representation, audience, ideology and media influence', 'production design, planning and media processes', 'industry, regulation, technologies and ethical issues', 'analysis and evaluation of media products'],
  'visual-communication-design': ['design elements, principles, conventions and communication needs', 'research, ideation, visualisation and design thinking', 'manual and digital drawing methods and presentation formats', 'client, audience, purpose, constraints and evaluation', 'design process documentation and refinement'],
  'art-creative-practice': ['creative practice, experimentation and art process', 'artists, artworks, contexts and interpretive frameworks', 'materials, techniques and visual language', 'critique, reflection and refinement of resolved works', 'presentation, meaning and audience response'],
  'art-making-exhibiting': ['art making, materials, techniques and resolved artworks', 'exhibition design, curation and presentation contexts', 'artist practice, interpretation and viewer engagement', 'documentation, critique and refinement', 'safe, ethical and sustainable art practices'],
  drama: ['expressive skills, performance styles and dramatic elements', 'devising, scripting, rehearsing and ensemble processes', 'character, structure, tension and audience engagement', 'analysis of performance choices and meaning', 'reflection, feedback and refinement'],
  'theatre-studies': ['script interpretation, production roles and theatre technologies', 'stagecraft, design, rehearsal and performance processes', 'theatre styles, conventions and contexts', 'analysis and evaluation of production choices', 'collaboration, planning and presentation'],

  french: ['listening, speaking, reading and writing in French', 'vocabulary, grammar, text types and register', 'Francophone culture, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original French for audience and purpose'],
  german: ['listening, speaking, reading and writing in German', 'vocabulary, grammar, text types and register', 'German-speaking cultures, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original German for audience and purpose'],
  italian: ['listening, speaking, reading and writing in Italian', 'vocabulary, grammar, text types and register', 'Italian-speaking cultures, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original Italian for audience and purpose'],
  'japanese-second-language': ['listening, speaking, reading and writing in Japanese', 'scripts, vocabulary, grammar, text types and register', 'Japanese culture, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original Japanese for audience and purpose'],
  'chinese-second-language': ['listening, speaking, reading and writing in Chinese', 'characters, vocabulary, grammar, text types and register', 'Chinese-speaking cultures, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original Chinese for audience and purpose'],
  spanish: ['listening, speaking, reading and writing in Spanish', 'vocabulary, grammar, text types and register', 'Spanish-speaking cultures, perspectives and intercultural understanding', 'responding to spoken and written texts', 'creating original Spanish for audience and purpose'],
}

function teachingExplanation(category: VceCourseCategory, courseName: string) {
  switch (category) {
    case 'English':
      return `In ${courseName}, learn this by asking how the text is constructed: what choices are made, what meanings they create, and why they matter for audience, purpose and context.`
    case 'Mathematics':
      return `In ${courseName}, learn this as a method plus an interpretation: know the rule, apply it accurately, then explain what the result means in the problem context.`
    case 'Science':
      return `In ${courseName}, learn this as a biological, chemical or physical relationship: define the concept, explain the mechanism, then connect it to evidence or data.`
    case 'Humanities':
      return `In ${courseName}, learn this through evidence: identify the concept, connect it to a source or case study, and explain its significance or consequence.`
    case 'Business':
      return `In ${courseName}, learn this as a decision-making tool: define the concept, apply it to a case, then judge its effect on stakeholders or outcomes.`
    case 'Health and PE':
      return `In ${courseName}, learn this by linking the factor to a body, health, wellbeing, performance or environment outcome using data or a scenario.`
    case 'Technology':
      return `In ${courseName}, learn this as a design or systems decision: identify the requirement, explain how the solution works, then test it against criteria.`
    case 'Arts':
      return `In ${courseName}, learn this by connecting creative choices to meaning, audience, context and process evidence.`
    case 'Languages':
      return `In ${courseName}, learn this by recognising how language choices communicate meaning, register, audience and culture.`
  }
}

function vceExampleFor(category: VceCourseCategory, courseName: string, detail: string) {
  switch (category) {
    case 'English':
      return `Example: if the point is ${detail}, a VCE response should use a short piece of textual evidence and explain how it shapes a reader's interpretation.`
    case 'Mathematics':
      return `Example: if the point is ${detail}, a VCE response should show working, use correct notation, and finish with an interpreted answer.`
    case 'Science':
      return `Example: if the point is ${detail}, a VCE response should name the process, explain the cause-and-effect sequence, and refer to data or conditions where relevant.`
    case 'Humanities':
      return `Example: if the point is ${detail}, a VCE response should use evidence from a place, event, source or case study and explain significance.`
    case 'Business':
      return `Example: if the point is ${detail}, a VCE response should apply it to the business, legal or economic scenario instead of defining it in isolation.`
    case 'Health and PE':
      return `Example: if the point is ${detail}, a VCE response should connect the concept to a specific health, wellbeing, movement or performance outcome.`
    case 'Technology':
      return `Example: if the point is ${detail}, a VCE response should link user needs, constraints, design decisions, testing evidence and evaluation.`
    case 'Arts':
      return `Example: if the point is ${detail}, a VCE response should refer to specific conventions, materials, processes or production choices.`
    case 'Languages':
      return `Example: if the point is ${detail}, a VCE response should show meaning through accurate vocabulary, grammar, register and cultural context.`
  }
}

function misconceptionFor(category: VceCourseCategory, detail: string) {
  switch (category) {
    case 'Mathematics':
      return `Do not stop at the answer. VCE marks often depend on method, notation, restrictions and interpretation.`
    case 'Science':
      return `Do not only name the concept. VCE answers usually need the mechanism, conditions and evidence behind ${detail}.`
    case 'English':
      return `Do not retell the text. VCE analysis needs authorial choices, evidence and explanation of effect.`
    case 'Languages':
      return `Do not translate word by word. VCE language work needs meaning, register and cultural context.`
    default:
      return `Do not give a memorised definition only. A VCE answer should apply ${detail} to the task, evidence or scenario.`
  }
}

function checkQuestionFor(category: VceCourseCategory, courseName: string, detail: string) {
  switch (category) {
    case 'Mathematics':
      return `How would you recognise when a ${courseName} question is testing ${detail}, and what working must be shown?`
    case 'Science':
      return `Explain how ${detail} works, then name one piece of evidence or data that would support the explanation.`
    case 'English':
      return `How does ${detail} help create meaning or persuade an audience? Use one piece of evidence in your answer.`
    case 'Languages':
      return `How would you communicate ${detail} accurately for a specific audience, purpose and register?`
    default:
      return `In a VCE-style scenario, how would you apply ${detail} and what evidence would prove your answer?`
  }
}

function answerGuideFor(category: VceCourseCategory) {
  switch (category) {
    case 'Mathematics':
      return `A strong answer identifies the relevant concept, shows correct steps, states restrictions or assumptions, and interprets the result.`
    case 'Science':
      return `A strong answer uses correct terminology, explains the cause-and-effect mechanism, and links the idea to valid evidence.`
    case 'English':
      return `A strong answer makes a clear claim, uses precise evidence, analyses language/form/structure and links back to meaning or purpose.`
    case 'Languages':
      return `A strong answer controls vocabulary, grammar, text type and register while showing cultural understanding.`
    default:
      return `A strong answer defines the idea briefly, applies it to the context, uses evidence and finishes with a clear judgement or explanation.`
  }
}

function buildKeyKnowledgePoint(detail: string, index: number, name: string, category: VceCourseCategory): VceKeyKnowledgePoint {
  return {
    label: `Key knowledge ${index + 1}`,
    detail,
    explanation: teachingExplanation(category, name),
    vceExample: vceExampleFor(category, name, detail),
    misconception: misconceptionFor(category, detail),
    checkQuestion: checkQuestionFor(category, name, detail),
    answerGuide: answerGuideFor(category),
  }
}

function keyKnowledgeFor(id: string, name: string, category: VceCourseCategory, description: string): VceKeyKnowledgePoint[] {
  const fallback = [
    `${description.replace(/\.$/, '')} as required knowledge for ${name}`,
    `${categorySkillPhrase(category)} as visible study-design skills`,
    'outcome evidence, assessment readiness and revision checkpoints',
  ]

  return (SUBJECT_KEY_KNOWLEDGE[id] ?? fallback).map((detail, index) => buildKeyKnowledgePoint(detail, index, name, category))
}

function commandTermsFor(category: VceCourseCategory): VceCommandTerm[] {
  return CATEGORY_COMMAND_TERMS[category]
}

function rotatingSlice<T>(items: T[], seed: number, count: number): T[] {
  if (items.length <= count) return [...items]
  return Array.from({ length: count }, (_, index) => items[(seed + index) % items.length])
}
function categorySkillPhrase(category: VceCourseCategory) {
  switch (category) {
    case 'English':
      return 'close reading, argument, language choices and audience control'
    case 'Mathematics':
      return 'modelling, exact working, technology use and interpretation'
    case 'Science':
      return 'scientific method, data interpretation, models and evidence'
    case 'Humanities':
      return 'source analysis, concepts, evidence and explanation'
    case 'Business':
      return 'case analysis, decision-making, evaluation and business/legal reasoning'
    case 'Health and PE':
      return 'applied concepts, data use, movement or health analysis and evaluation'
    case 'Technology':
      return 'design processes, systems thinking, testing and evaluation'
    case 'Arts':
      return 'creative process, analysis, interpretation and presentation'
    case 'Languages':
      return 'listening, speaking, reading, writing and cultural understanding'
  }
}

function lessonId(unit: 1 | 2 | 3 | 4, chapterIndex: number, lessonIndex: number) {
  return `u${unit}-c${chapterIndex + 1}-l${lessonIndex + 1}`
}

type LessonOverride = {
  title: string
  focus: string
  points: string[]
}

type ChapterOverride = {
  title: string
  outcome: string
  studyDesignFocus: string
  lessons: LessonOverride[]
}

type UnitOverride = {
  unit: 1 | 2 | 3 | 4
  title: string
  focus: string
  chapters: ChapterOverride[]
}

const BIOLOGY_UNITS: UnitOverride[] = [
  {
    unit: 1,
    title: 'Unit 1: How do organisms regulate their functions?',
    focus: 'Cells, specialised systems, regulation and student-designed investigation skills.',
    chapters: [
      {
        title: 'Area of Study 1: How do cells function?',
        outcome: 'Explain and compare cellular structure and function, and analyse cell growth, death and differentiation.',
        studyDesignFocus: 'Cell structure, membranes, cell cycle, apoptosis and stem cells',
        lessons: [
          {
            title: 'Cells and membranes',
            focus: 'Learn how cell structures make survival possible.',
            points: [
              'cells as the basic structural unit of life, including differences between prokaryotic and eukaryotic cells',
              'surface area to volume ratio and why cell size is limited',
              'plasma membrane structure and transport by osmosis, facilitated diffusion and active transport',
            ],
          },
          {
            title: 'Organelles and cell specialisation',
            focus: 'Connect organelle structure to function.',
            points: [
              'plant and animal organelles specialised for distinct functions, including chloroplasts and mitochondria',
              'internal compartments that allow cells to carry out specialised reactions efficiently',
              'how cell structures support exchange, energy transformation and regulation',
            ],
          },
          {
            title: 'Cell cycle, cancer and stem cells',
            focus: 'Understand controlled growth and what happens when regulation fails.',
            points: [
              'binary fission in prokaryotes and mitosis/cytokinesis in eukaryotes',
              'apoptosis as regulated programmed cell death',
              'disrupted cell-cycle control, cancer-cell behaviour, pluripotency and totipotency in stem cells',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 2: How do plant and animal systems function?',
        outcome: 'Explain and compare specialised cells and systems in plants and animals, and analyse regulation.',
        studyDesignFocus: 'Specialisation, plant water balance and animal homeostasis',
        lessons: [
          {
            title: 'Specialised tissues and systems',
            focus: 'Learn how cells organise into tissues, organs and systems.',
            points: [
              'plant cells organised into tissues for water intake, movement and loss',
              'animal cells organised into digestive, endocrine and excretory systems',
              'specialisation as the link between cell structure and whole-organism function',
            ],
          },
          {
            title: 'Homeostatic regulation',
            focus: 'Use stimulus-response models to explain internal balance.',
            points: [
              'regulation of body temperature, blood glucose and water balance by homeostatic mechanisms',
              'feedback loops and organ structures involved in maintaining tolerance ranges',
              'regulation of water balance in vascular plants',
            ],
          },
          {
            title: 'Malfunctions in regulation',
            focus: 'Apply homeostasis to disease examples.',
            points: [
              'type 1 diabetes as a malfunction in blood glucose regulation',
              'hypoglycaemia as a failure to maintain blood glucose within a safe range',
              'hyperthyroidism as a regulatory disruption affecting metabolism',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 3: How do investigations develop understanding of organism function?',
        outcome: 'Adapt or design and conduct a scientific investigation, then draw a conclusion from primary data.',
        studyDesignFocus: 'Investigation design, primary data, validity and science communication',
        lessons: [
          {
            title: 'Designing the investigation',
            focus: 'Turn a biological idea into a testable investigation.',
            points: [
              'biological concepts and key terms relevant to the investigation',
              'scientific methodology selected for the research question',
              'techniques for generating primary qualitative and quantitative data',
            ],
          },
          {
            title: 'Evaluating evidence',
            focus: 'Judge whether data can support a conclusion.',
            points: [
              'accuracy, precision, repeatability, reproducibility and validity of measurements',
              'patterns, relationships, errors and limitations in generated primary data',
              'logbooks as evidence for authentication of primary data',
            ],
          },
          {
            title: 'Communicating findings',
            focus: 'Present a scientific conclusion clearly.',
            points: [
              'scientific terminology, representations, abbreviations and units',
              'conventions of scientific report writing',
              'ways of presenting key findings and implications of an investigation',
            ],
          },
        ],
      },
    ],
  },
  {
    unit: 2,
    title: 'Unit 2: How does inheritance impact on diversity?',
    focus: 'Inheritance, genetic diversity, adaptations, interdependencies and bioethical communication.',
    chapters: [
      {
        title: 'Area of Study 1: How is inheritance explained?',
        outcome: 'Explain and compare chromosomes, genomes, genotypes and phenotypes, and analyse patterns of inheritance.',
        studyDesignFocus: 'Chromosomes, meiosis, inheritance patterns and genetic crosses',
        lessons: [
          {
            title: 'Chromosomes, genes and genomes',
            focus: 'Build the vocabulary needed for inheritance questions.',
            points: [
              'distinctions between genes, alleles and a genome',
              'homologous chromosome pairs, gene loci, autosomes and sex chromosomes',
              'karyotypes used to identify chromosome abnormalities',
            ],
          },
          {
            title: 'Meiosis and variation',
            focus: 'Explain how gametes create genetic diversity.',
            points: [
              'production of haploid gametes from diploid cells by meiosis',
              'crossing over and independent assortment as sources of genetic diversity',
              'environmental and epigenetic factors influencing phenotype',
            ],
          },
          {
            title: 'Inheritance predictions',
            focus: 'Use symbols and pedigrees to predict outcomes.',
            points: [
              'writing genotypes using symbols for alleles at a gene locus',
              'dominance, recessiveness, codominance and incomplete dominance',
              'pedigrees, monohybrid crosses, test crosses and linked or independently assorting genes',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 2: How do inherited adaptations impact on diversity?',
        outcome: 'Analyse reproductive strategies and evaluate how adaptations and interdependencies enhance survival.',
        studyDesignFocus: 'Reproductive strategies, adaptations, diversity and ecosystem interdependence',
        lessons: [
          {
            title: 'Reproductive strategies',
            focus: 'Compare how reproduction affects diversity.',
            points: [
              'biological advantages and disadvantages of asexual reproduction',
              'sexual reproduction increasing genetic diversity of offspring',
              'processes and applications of reproductive cloning technologies',
            ],
          },
          {
            title: 'Adaptations and survival',
            focus: 'Explain how inherited traits improve survival.',
            points: [
              'importance of genetic diversity within a species or population',
              'structural, physiological and behavioural adaptations that enhance survival',
              'adaptations enabling organisms to live in a wide range of environments',
            ],
          },
          {
            title: 'Species interdependence',
            focus: 'Analyse survival through ecological relationships.',
            points: [
              'interdependencies between species and ecosystem survival',
              'effects of changes to keystone species and top predators on population size, density and distribution',
              'Aboriginal and Torres Strait Islander knowledge in understanding adaptations and interdependencies',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 3: How do humans use science to explore bioethical issues?',
        outcome: 'Identify, analyse and evaluate a bioethical issue in genetics, reproductive science or adaptations.',
        studyDesignFocus: 'Secondary evidence, science communication and bioethical evaluation',
        lessons: [
          {
            title: 'Evidence in bioethics',
            focus: 'Separate scientific evidence from weaker claims.',
            points: [
              'distinctions between primary data, secondary data, opinion, anecdote and evidence',
              'quality of evidence including validity, authority, error and bias',
              'organising, analysing and evaluating secondary data',
            ],
          },
          {
            title: 'Communicating a bioethical issue',
            focus: 'Explain science accurately for an audience.',
            points: [
              'definitions of key biological terms for the selected issue',
              'effective science communication using accuracy, clarity, conciseness and coherence',
              'social, economic, legal and political factors relevant to the research question',
            ],
          },
          {
            title: 'Evaluating ethical positions',
            focus: 'Use ethical reasoning to support a position.',
            points: [
              'ways of identifying bioethical issues',
              'characteristics of effective analysis of bioethical issues',
              'bioethical approaches and ethical concepts applied to the selected issue',
            ],
          },
        ],
      },
    ],
  },
  {
    unit: 3,
    title: 'Unit 3: How do cells maintain life?',
    focus: 'Nucleic acids, proteins, DNA manipulation, biochemical pathways and biotechnology.',
    chapters: [
      {
        title: 'Area of Study 1: What is the role of nucleic acids and proteins in maintaining life?',
        outcome: 'Analyse the relationship between nucleic acids and proteins, and evaluate DNA manipulation tools and applications.',
        studyDesignFocus: 'DNA, RNA, gene expression, protein synthesis and DNA technologies',
        lessons: [
          {
            title: 'Nucleic acids and gene expression',
            focus: 'Learn how DNA information becomes protein.',
            points: [
              'DNA and RNA as information molecules, including mRNA, rRNA and tRNA',
              'genetic code as a universal triplet code and the major steps in gene expression',
              'gene structure including exons, introns, promoters and operator regions',
            ],
          },
          {
            title: 'Proteins and regulation',
            focus: 'Connect gene expression to functional proteins.',
            points: [
              'basic gene regulation using the prokaryotic trp operon as a simplified model',
              'amino acids forming polypeptides and hierarchical protein structure',
              'enzymes as catalysts and proteins as part of an organism proteome',
            ],
          },
          {
            title: 'DNA manipulation technologies',
            focus: 'Evaluate tools used to manipulate DNA.',
            points: [
              'polymerase, ligase and endonucleases used to manipulate DNA',
              'CRISPR-Cas9, PCR, gel electrophoresis and interpretation of DNA profiles',
              'recombinant plasmids, bacterial transformation, genetically modified and transgenic organisms',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 2: How are biochemical pathways regulated?',
        outcome: 'Analyse photosynthesis and cellular respiration, and evaluate biotechnology related to pathway regulation.',
        studyDesignFocus: 'Biochemical pathways, enzymes, photosynthesis, respiration and biotechnology',
        lessons: [
          {
            title: 'Pathways and enzymes',
            focus: 'Understand how biochemical pathways are controlled.',
            points: [
              'general structure of biochemical pathways from initial reactant to final product',
              'enzymes and coenzymes facilitating pathway steps',
              'temperature, pH, concentration and enzyme inhibitors affecting reaction rate',
            ],
          },
          {
            title: 'Photosynthesis and respiration',
            focus: 'Compare pathway inputs, outputs and locations.',
            points: [
              'light-dependent and light-independent stages of photosynthesis in C3 plants',
              'Rubisco and C3, C4 and CAM adaptations that affect photosynthetic efficiency',
              'glycolysis, Krebs cycle, electron transport chain and ATP yield in cellular respiration',
            ],
          },
          {
            title: 'Biotechnology applications',
            focus: 'Evaluate how biotechnology can solve pathway problems.',
            points: [
              'factors affecting photosynthesis and respiration rates',
              'anaerobic fermentation in animals and yeasts',
              'CRISPR-Cas9 for crop productivity and anaerobic fermentation of biomass for biofuel production',
            ],
          },
        ],
      },
      {
        title: 'Unit 3/4 Investigation: Cellular processes and biological change',
        outcome: 'Design, analyse and communicate a scientific investigation assessed through Unit 4 Outcome 3.',
        studyDesignFocus: 'Scientific inquiry connected to Units 3 and 4 knowledge',
        lessons: [
          {
            title: 'Investigation planning',
            focus: 'Plan a primary-data investigation connected to cellular processes or biological change.',
            points: [
              'research question, aim, hypothesis and relevant biological concepts',
              'independent, dependent and controlled variables',
              'risk, safety and ethical guidelines relevant to the investigation',
            ],
          },
          {
            title: 'Data and analysis',
            focus: 'Use data to support or refute a hypothesis.',
            points: [
              'primary quantitative data generation and measurement quality',
              'patterns, relationships, error and uncertainty in results',
              'assumptions and limitations of methods and data analysis',
            ],
          },
          {
            title: 'Scientific poster',
            focus: 'Communicate investigation findings in the required poster format.',
            points: [
              'scientific terminology, symbols, formulas and units',
              'poster conventions including succinct results, discussion and conclusion',
              'key findings, implications, acknowledgements and references',
            ],
          },
        ],
      },
    ],
  },
  {
    unit: 4,
    title: 'Unit 4: How does life change and respond to challenges?',
    focus: 'Immune responses, disease strategies, evolution, relatedness and scientific poster evidence.',
    chapters: [
      {
        title: 'Area of Study 1: How do organisms respond to pathogens?',
        outcome: 'Analyse immune responses, compare acquired immunity and evaluate disease-treatment challenges and strategies.',
        studyDesignFocus: 'Barriers, innate and adaptive immunity, vaccination and immunotherapy',
        lessons: [
          {
            title: 'Barriers and innate immunity',
            focus: 'Learn how organisms prevent and respond quickly to infection.',
            points: [
              'physical, chemical and microbiota barriers preventing pathogenic infection',
              'innate immune response including inflammation and key immune cells',
              'antigen presentation, self and non-self antigens, pathogens and allergens',
            ],
          },
          {
            title: 'Adaptive immunity',
            focus: 'Explain targeted immune responses.',
            points: [
              'lymphatic system and lymph nodes in antigen recognition by T and B lymphocytes',
              'B cells, antibodies, helper T cells and cytotoxic T cells against extracellular and intracellular threats',
              'natural/artificial and active/passive immunity',
            ],
          },
          {
            title: 'Disease challenges and strategies',
            focus: 'Evaluate strategies used to identify, prevent and treat disease.',
            points: [
              'emerging and re-emerging pathogens in a globally connected world',
              'identification of pathogens, hosts, transmission and control measures',
              'vaccination programs, herd immunity and monoclonal antibody immunotherapy',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 2: How are species related over time?',
        outcome: 'Analyse evidence for genetic change, species relatedness and human change over time.',
        studyDesignFocus: 'Allele frequencies, speciation, phylogeny, fossils and human evolution',
        lessons: [
          {
            title: 'Genetic change in populations',
            focus: 'Explain how gene pools change over time.',
            points: [
              'changing allele frequencies through selection pressures, genetic drift, gene flow and mutation',
              'consequences of allele-frequency change for genetic diversity',
              'selective breeding, bacterial resistance and viral antigenic drift or shift',
            ],
          },
          {
            title: 'Speciation and relatedness',
            focus: 'Use evidence to explain species change and relationships.',
            points: [
              'fossil evidence including succession, index fossils, transitional fossils and dating',
              'speciation through isolation and genetic divergence, including allopatric and sympatric examples',
              'structural morphology, molecular homology and phylogenetic trees as evidence of relatedness',
            ],
          },
          {
            title: 'Human change over time',
            focus: 'Evaluate evidence for hominin evolution and migration.',
            points: [
              'shared characteristics of mammals, primates, hominoids and hominins',
              'major trends from Australopithecus to Homo, including brain size and limb structure',
              'fossil and DNA evidence for migration of modern human populations and connection to Country and Place',
            ],
          },
        ],
      },
      {
        title: 'Area of Study 3: How is scientific inquiry used to investigate biological change?',
        outcome: 'Design and conduct an investigation and present aim, method, results, discussion and conclusion in a scientific poster.',
        studyDesignFocus: 'Primary data investigation, validity, limitations and scientific poster communication',
        lessons: [
          {
            title: 'Poster investigation design',
            focus: 'Design a defensible investigation for Unit 4 Outcome 3.',
            points: [
              'biological concepts and definitions specific to the selected investigation',
              'selected methodology, variables and method suitability',
              'primary quantitative data generation, safety and ethical guidelines',
            ],
          },
          {
            title: 'Evidence and limitations',
            focus: 'Analyse whether the evidence supports the hypothesis.',
            points: [
              'evidence that supports or refutes a hypothesis, model or theory',
              'organising and evaluating primary data, including error and uncertainty',
              'logbook authentication, assumptions and limitations of method and data analysis',
            ],
          },
          {
            title: 'Poster communication',
            focus: 'Write the scientific poster like a VCE Biology student.',
            points: [
              'scientific terminology, representations, symbols, formulas, abbreviations and units',
              'poster conventions for succinct communication of the investigation',
              'key findings, implications, acknowledgements and references',
            ],
          },
        ],
      },
    ],
  },
]

function levelsFromOverride(courseName: string, category: VceCourseCategory, units: UnitOverride[]): VceCourseLevel[] {
  return units.map((unit) => ({
    unit: unit.unit,
    title: unit.title,
    focus: unit.focus,
    chapters: unit.chapters.map((chapter, chapterIndex) => ({
      id: `u${unit.unit}-c${chapterIndex + 1}`,
      title: chapter.title,
      outcome: chapter.outcome,
      studyDesignFocus: chapter.studyDesignFocus,
      lessons: chapter.lessons.map((lesson, lessonIndex) => {
        const keyKnowledge = lesson.points.map((point, index) => buildKeyKnowledgePoint(point, index, courseName, category))
        return {
          id: lessonId(unit.unit, chapterIndex, lessonIndex),
          title: lesson.title,
          objective: lesson.focus,
          studyDesignFocus: chapter.studyDesignFocus,
          keyKnowledge,
          commandTerms: rotatingSlice(commandTermsFor(category), chapterIndex + lessonIndex, 3),
          practice: keyKnowledge.map((point) => point.checkQuestion),
        }
      }),
    })),
  }))
}
function course(id: string, name: string, category: VceCourseCategory, description: string): VceCourse {
  const topicPhrase = description.replace(/\.$/, '').toLowerCase()
  const skillPhrase = categorySkillPhrase(category)
  const keyKnowledge = keyKnowledgeFor(id, name, category, description)
  const commandTerms = commandTermsFor(category)
  const verifiedLevels = id === 'biology' ? levelsFromOverride(name, category, BIOLOGY_UNITS) : null

  return {
    id,
    name,
    category,
    description,
    studyDesign: {
      sourceUrl: studyDesignSourceUrlFor(id),
      keyKnowledge: verifiedLevels ? verifiedLevels.flatMap((level) => level.chapters.flatMap((chapter) => chapter.lessons.flatMap((lesson) => lesson.keyKnowledge))).slice(0, 12) : keyKnowledge,
      commandTerms,
    },
    levels: verifiedLevels ?? UNIT_BLUEPRINTS.map((unit) => ({
      unit: unit.unit,
      title: unit.title,
      focus: unit.focus,
      chapters: unit.chapters.map((chapter, chapterIndex) => ({
        id: `u${unit.unit}-c${chapterIndex + 1}`,
        title: chapter.title,
        outcome: chapter.outcome,
        studyDesignFocus: chapter.studyDesignFocus,
        lessons: chapter.lessons.map((lesson, lessonIndex) => ({
          id: lessonId(unit.unit, chapterIndex, lessonIndex),
          title: lesson.title,
          objective: `${lesson.objective} For ${name}, this lesson uses ${topicPhrase}.`,
          studyDesignFocus: lesson.studyDesignFocus,
          keyKnowledge: rotatingSlice(keyKnowledge, unit.unit + chapterIndex + lessonIndex, 4),
          commandTerms: rotatingSlice(commandTerms, chapterIndex + lessonIndex, 3),
          practice: lesson.practice(name, topicPhrase, skillPhrase),
        })),
      })),
    })),
  }
}

export const VCE_COURSES: VceCourse[] = [
  course('bridging-english-eal', 'Bridging English as an Additional Language', 'English', 'Bridging English language, communication, text response and EAL learning pathways.'),
  course('english', 'English', 'English', 'Reading, writing, oral communication, argument, and text response.'),
  course('english-language', 'English Language', 'English', 'Linguistics, language change, identity, discourse, and metalanguage.'),
  course('foundation-english', 'Foundation English', 'English', 'Practical English literacy, communication, texts, workplace and community contexts.'),
  course('literature', 'Literature', 'English', 'Close analysis, interpretation, adaptation, and literary perspectives.'),
  course('vce-vm-literacy', 'VCE VM Literacy', 'English', 'Applied literacy, communication, critical reading, writing and community contexts.'),
  course('english-eal', 'English as an Additional Language', 'English', 'EAL reading, listening, comparative, oral, and analytical skills.'),

  course('vce-vm-numeracy', 'VCE VM Numeracy', 'Mathematics', 'Applied numeracy, measurement, finance, data, problem solving and practical mathematics.'),
  course('foundation-mathematics', 'Foundation Mathematics', 'Mathematics', 'Numeracy, data, measurement, finance, and applied mathematical reasoning.'),
  course('general-mathematics', 'General Mathematics', 'Mathematics', 'Data, networks, matrices, finance, recursion, and applied problem solving.'),
  course('mathematical-methods', 'Mathematical Methods', 'Mathematics', 'Functions, calculus, probability, algebra, and technology-enabled reasoning.'),
  course('specialist-mathematics', 'Specialist Mathematics', 'Mathematics', 'Advanced algebra, vectors, mechanics, calculus, proof, and complex numbers.'),

  course('biology', 'Biology', 'Science', 'Cells, systems, genetics, evolution, immunity, and biological change.'),
  course('chemistry', 'Chemistry', 'Science', 'Structure, reactions, energy, equilibrium, organic chemistry, and analysis.'),
  course('physics', 'Physics', 'Science', 'Motion, fields, electricity, light, matter, and experimental reasoning.'),
  course('psychology', 'Psychology', 'Science', 'Brain, behaviour, mental processes, research methods, and wellbeing.'),
  course('environmental-science', 'Environmental Science', 'Science', 'Ecosystems, biodiversity, climate, sustainability, and investigation.'),

  course('classical-studies', 'Classical Studies', 'Humanities', 'Classical societies, literature, ideas, material culture, evidence and interpretation.'),
  course('geography', 'Geography', 'Humanities', 'Place, data, environments, fieldwork, human change, and spatial analysis.'),
  course('history-ancient', 'Ancient History', 'Humanities', 'Ancient societies, evidence, power, beliefs, and historical interpretation.'),
  course('history-australian', 'Australian History', 'Humanities', 'Australian change, identity, conflict, reform, and evidence.'),
  course('history-revolutions', 'History: Revolutions', 'Humanities', 'Causes, consequences, leaders, ideas, and revolutionary change.'),
  course('philosophy', 'Philosophy', 'Humanities', 'Arguments, ethics, metaphysics, knowledge, and philosophical analysis.'),
  course('religion-society', 'Religion and Society', 'Humanities', 'Religious traditions, beliefs, values, communities, ethics and social influence.'),
  course('sociology', 'Sociology', 'Humanities', 'Culture, identity, community, social change, and research evidence.'),
  course('texts-traditions', 'Texts and Traditions', 'Humanities', 'Sacred texts, traditions, interpretation, context and religious meaning.'),
  course('politics', 'Politics', 'Humanities', 'Power, democracy, global actors, political ideas, and policy debate.'),

  course('accounting', 'Accounting', 'Business', 'Financial records, reports, analysis, decision-making, and business performance.'),
  course('business-management', 'Business Management', 'Business', 'Operations, management, change, stakeholders, and business strategy.'),
  course('economics', 'Economics', 'Business', 'Markets, policy, economic goals, trade, inflation, and decision-making.'),
  course('industry-enterprise', 'Industry and Enterprise', 'Business', 'Workplace participation, enterprise skills, industry change and career pathways.'),
  course('legal-studies', 'Legal Studies', 'Business', 'Justice, law-making, rights, institutions, and legal reform.'),
  course('vce-vm-work-related-skills', 'VCE VM Work Related Skills', 'Business', 'Workplace skills, career planning, enterprise, occupational health and work futures.'),

  course('vce-vm-personal-development-skills', 'VCE VM Personal Development Skills', 'Health and PE', 'Personal development, community participation, leadership, wellbeing and social awareness.'),
  course('health-human-development', 'Health and Human Development', 'Health and PE', 'Health, wellbeing, development, equity, and global health.'),
  course('physical-education', 'Physical Education', 'Health and PE', 'Movement, training, energy systems, performance, and analysis.'),
  course('outdoor-environmental-studies', 'Outdoor and Environmental Studies', 'Health and PE', 'Outdoor relationships, environments, sustainability, and place.'),

  course('algorithmics', 'Algorithmics (HESS)', 'Technology', 'Algorithm design, abstraction, computational thinking, data structures and complexity.'),
  course('applied-computing', 'Applied Computing', 'Technology', 'Data, programming, digital systems, and problem-solving processes.'),
  course('data-analytics', 'Data Analytics', 'Technology', 'Data design, analysis, visualisation, security, and project management.'),
  course('software-development', 'Software Development', 'Technology', 'Programming, algorithms, software design, testing, and development models.'),
  course('agricultural-horticultural-studies', 'Agricultural and Horticultural Studies', 'Technology', 'Agriculture, horticulture, production systems, sustainability, science and industry practice.'),
  course('product-design-technology', 'Product Design and Technologies', 'Technology', 'Design processes, materials, production, evaluation, and innovation.'),
  course('systems-engineering', 'Systems Engineering', 'Technology', 'Mechanical and electrical systems, design, construction, and testing.'),
  course('food-studies', 'Food Studies', 'Technology', 'Food systems, nutrition, production, culture, and sustainability.'),

  course('dance', 'Dance', 'Arts', 'Dance technique, choreography, performance, analysis and movement composition.'),
  course('media', 'Media', 'Arts', 'Media forms, narratives, production, representation, and audience.'),
  course('music', 'Music', 'Arts', 'Music performance, creating, responding, analysis, technique and musicianship.'),
  course('visual-communication-design', 'Visual Communication Design', 'Arts', 'Design thinking, visual language, communication, and presentation.'),
  course('art-creative-practice', 'Art Creative Practice', 'Arts', 'Art process, critique, experimentation, and resolved artworks.'),
  course('art-making-exhibiting', 'Art Making and Exhibiting', 'Arts', 'Making, curating, presenting, interpreting, and exhibiting art.'),
  course('drama', 'Drama', 'Arts', 'Performance, expressive skills, devising, analysis, and ensemble work.'),
  course('theatre-studies', 'Theatre Studies', 'Arts', 'Production roles, interpretation, performance, and theatre analysis.'),
  course('extended-investigation', 'Extended Investigation', 'Humanities', 'Research design, critical thinking, evidence, argument and extended academic investigation.'),

  course('french', 'French', 'Languages', 'Communication, culture, grammar, listening, speaking, reading, and writing.'),
  course('german', 'German', 'Languages', 'Communication, culture, grammar, listening, speaking, reading, and writing.'),
  course('italian', 'Italian', 'Languages', 'Communication, culture, grammar, listening, speaking, reading, and writing.'),
  course('japanese-second-language', 'Japanese Second Language', 'Languages', 'Communication, culture, scripts, listening, speaking, reading, and writing.'),
  course('chinese-second-language', 'Chinese Second Language', 'Languages', 'Communication, culture, characters, listening, speaking, reading, and writing.'),
  course('spanish', 'Spanish', 'Languages', 'Communication, culture, grammar, listening, speaking, reading, and writing.'),
]

export const VCE_COURSE_CATEGORIES: VceCourseCategory[] = ['English', 'Mathematics', 'Science', 'Humanities', 'Business', 'Health and PE', 'Technology', 'Arts', 'Languages']

export function currentCourseMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function resolveCourseAccess(
  plan: NexusPlan,
  courseId: string,
  unit: 1 | 2 | 3 | 4,
  selection: CourseAccessSelection,
  monthKey = currentCourseMonthKey(),
): CourseAccessResult {
  if (plan === 'Premium') return { unlocked: true, reason: 'premium', requiredPlan: null }
  if (selection.freeSubjectId === courseId) return { unlocked: true, reason: 'free-subject', requiredPlan: null }
  if (plan === 'Plus' && selection.plusMonthKey === monthKey && selection.plusCourseId === courseId && selection.plusUnit === unit) {
    return { unlocked: true, reason: 'plus-monthly-unit', requiredPlan: null }
  }
  return { unlocked: false, reason: 'locked', requiredPlan: plan === 'Free' ? 'Plus' : 'Premium' }
}
