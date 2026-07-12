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

function keyKnowledgeFor(id: string, name: string, category: VceCourseCategory, description: string): VceKeyKnowledgePoint[] {
  const fallback = [
    `${description.replace(/\.$/, '')} as required knowledge for ${name}`,
    `${categorySkillPhrase(category)} as visible study-design skills`,
    'outcome evidence, assessment readiness and revision checkpoints',
  ]

  return (SUBJECT_KEY_KNOWLEDGE[id] ?? fallback).map((detail, index) => ({
    label: `Key knowledge ${index + 1}`,
    detail,
  }))
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

function course(id: string, name: string, category: VceCourseCategory, description: string): VceCourse {
  const topicPhrase = description.replace(/\.$/, '').toLowerCase()
  const skillPhrase = categorySkillPhrase(category)
  const keyKnowledge = keyKnowledgeFor(id, name, category, description)
  const commandTerms = commandTermsFor(category)

  return {
    id,
    name,
    category,
    description,
    studyDesign: {
      sourceUrl: VCE_STUDY_DESIGN_SOURCE.url,
      keyKnowledge,
      commandTerms,
    },
    levels: UNIT_BLUEPRINTS.map((unit) => ({
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
  course('english', 'English', 'English', 'Reading, writing, oral communication, argument, and text response.'),
  course('english-language', 'English Language', 'English', 'Linguistics, language change, identity, discourse, and metalanguage.'),
  course('literature', 'Literature', 'English', 'Close analysis, interpretation, adaptation, and literary perspectives.'),
  course('english-eal', 'English as an Additional Language', 'English', 'EAL reading, listening, comparative, oral, and analytical skills.'),

  course('foundation-mathematics', 'Foundation Mathematics', 'Mathematics', 'Numeracy, data, measurement, finance, and applied mathematical reasoning.'),
  course('general-mathematics', 'General Mathematics', 'Mathematics', 'Data, networks, matrices, finance, recursion, and applied problem solving.'),
  course('mathematical-methods', 'Mathematical Methods', 'Mathematics', 'Functions, calculus, probability, algebra, and technology-enabled reasoning.'),
  course('specialist-mathematics', 'Specialist Mathematics', 'Mathematics', 'Advanced algebra, vectors, mechanics, calculus, proof, and complex numbers.'),

  course('biology', 'Biology', 'Science', 'Cells, systems, genetics, evolution, immunity, and biological change.'),
  course('chemistry', 'Chemistry', 'Science', 'Structure, reactions, energy, equilibrium, organic chemistry, and analysis.'),
  course('physics', 'Physics', 'Science', 'Motion, fields, electricity, light, matter, and experimental reasoning.'),
  course('psychology', 'Psychology', 'Science', 'Brain, behaviour, mental processes, research methods, and wellbeing.'),
  course('environmental-science', 'Environmental Science', 'Science', 'Ecosystems, biodiversity, climate, sustainability, and investigation.'),

  course('geography', 'Geography', 'Humanities', 'Place, data, environments, fieldwork, human change, and spatial analysis.'),
  course('history-ancient', 'Ancient History', 'Humanities', 'Ancient societies, evidence, power, beliefs, and historical interpretation.'),
  course('history-australian', 'Australian History', 'Humanities', 'Australian change, identity, conflict, reform, and evidence.'),
  course('history-revolutions', 'History: Revolutions', 'Humanities', 'Causes, consequences, leaders, ideas, and revolutionary change.'),
  course('philosophy', 'Philosophy', 'Humanities', 'Arguments, ethics, metaphysics, knowledge, and philosophical analysis.'),
  course('sociology', 'Sociology', 'Humanities', 'Culture, identity, community, social change, and research evidence.'),
  course('politics', 'Politics', 'Humanities', 'Power, democracy, global actors, political ideas, and policy debate.'),

  course('accounting', 'Accounting', 'Business', 'Financial records, reports, analysis, decision-making, and business performance.'),
  course('business-management', 'Business Management', 'Business', 'Operations, management, change, stakeholders, and business strategy.'),
  course('economics', 'Economics', 'Business', 'Markets, policy, economic goals, trade, inflation, and decision-making.'),
  course('legal-studies', 'Legal Studies', 'Business', 'Justice, law-making, rights, institutions, and legal reform.'),

  course('health-human-development', 'Health and Human Development', 'Health and PE', 'Health, wellbeing, development, equity, and global health.'),
  course('physical-education', 'Physical Education', 'Health and PE', 'Movement, training, energy systems, performance, and analysis.'),
  course('outdoor-environmental-studies', 'Outdoor and Environmental Studies', 'Health and PE', 'Outdoor relationships, environments, sustainability, and place.'),

  course('applied-computing', 'Applied Computing', 'Technology', 'Data, programming, digital systems, and problem-solving processes.'),
  course('data-analytics', 'Data Analytics', 'Technology', 'Data design, analysis, visualisation, security, and project management.'),
  course('software-development', 'Software Development', 'Technology', 'Programming, algorithms, software design, testing, and development models.'),
  course('product-design-technology', 'Product Design and Technologies', 'Technology', 'Design processes, materials, production, evaluation, and innovation.'),
  course('systems-engineering', 'Systems Engineering', 'Technology', 'Mechanical and electrical systems, design, construction, and testing.'),
  course('food-studies', 'Food Studies', 'Technology', 'Food systems, nutrition, production, culture, and sustainability.'),

  course('media', 'Media', 'Arts', 'Media forms, narratives, production, representation, and audience.'),
  course('visual-communication-design', 'Visual Communication Design', 'Arts', 'Design thinking, visual language, communication, and presentation.'),
  course('art-creative-practice', 'Art Creative Practice', 'Arts', 'Art process, critique, experimentation, and resolved artworks.'),
  course('art-making-exhibiting', 'Art Making and Exhibiting', 'Arts', 'Making, curating, presenting, interpreting, and exhibiting art.'),
  course('drama', 'Drama', 'Arts', 'Performance, expressive skills, devising, analysis, and ensemble work.'),
  course('theatre-studies', 'Theatre Studies', 'Arts', 'Production roles, interpretation, performance, and theatre analysis.'),

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
