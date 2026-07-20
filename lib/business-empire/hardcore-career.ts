import type { CareerFinanceBreakdown, Degree, DegreeProfile, EntranceQuizQuestion, HardcoreJob, Industry, JobInterviewQuestion } from '@/lib/business-empire/types'

/**
 * Hardcore Mode's pre-game life phase: the player starts at 16, takes a
 * one-time entrance quiz, chooses a degree path, then has to pass a job
 * interview before earning starting capital. Salary is not free cash: income
 * tax, housing, bills, transport, food, student debt, and emergency costs are
 * deducted before savings become company capital.
 */

export const STARTING_AGE = 16
export const UNIVERSITY_YEARS = 3
export const MAX_YEARS_WORKED = 10

export const UNIVERSITY_ENTRANCE_QUIZ: EntranceQuizQuestion[] = [
  { id: 'profit', prompt: 'A business sells a product for $50 that costs $30 to make. What is the profit per unit?', options: ['$30', '$20', '$50', '$80'], correctIndex: 1 },
  { id: 'net-profit', prompt: "A company's revenue is $100,000 and its expenses are $85,000. What is its net profit?", options: ['$85,000', '$100,000', '$15,000', '$185,000'], correctIndex: 2 },
  { id: 'market-share', prompt: "What does 'market share' measure?", options: ["A company's percentage of total sales in its industry", 'How many products a company sells', "A company's total profit", 'The number of employees a company has'], correctIndex: 0 },
  { id: 'price-drop', prompt: 'Why might a business lower its prices?', options: ['To attract more customers and increase sales volume', 'To reduce product quality', 'To avoid paying any tax', 'To reduce competition by breaking the law'], correctIndex: 0 },
  { id: 'loan', prompt: 'What is a business loan?', options: ['Money earned from sales', 'Money borrowed that must be repaid, usually with interest', 'A type of advertising', 'A government grant that never needs repaying'], correctIndex: 1 },
  { id: 'satisfaction', prompt: 'If customer satisfaction drops, what is a likely consequence for a business?', options: ['Automatically higher profit', 'No effect at all', 'Reduced repeat purchases and reputation damage', 'Lower production costs'], correctIndex: 2 },
]

export function scoreEntranceQuiz(answers: (number | null)[]): number {
  const correct = UNIVERSITY_ENTRANCE_QUIZ.reduce((count, question, index) => (answers[index] === question.correctIndex ? count + 1 : count), 0)
  return Math.round((correct / UNIVERSITY_ENTRANCE_QUIZ.length) * 100)
}

export function getUniversityTierLabel(universityQuality: number): string {
  if (universityQuality >= 85) return 'Elite University'
  if (universityQuality >= 60) return 'State University'
  if (universityQuality >= 35) return 'Community College'
  return 'No University Placement'
}

export const DEGREE_PROFILES: DegreeProfile[] = [
  { id: 'business', label: 'Business Degree', description: 'Marketing, sales, and analysis roles. Pairs well with retail, education, and consumer-facing industries.', relevantIndustries: ['Online Retail', 'Education', 'Cosmetics', 'Fitness'] },
  { id: 'engineering', label: 'Engineering Degree', description: 'Technical and manufacturing roles. Pairs well with technology, vehicles, and energy industries.', relevantIndustries: ['Technology', 'Smartphones', 'Cars', 'Renewable Energy', 'Video Games'] },
  { id: 'arts-design', label: 'Arts & Design Degree', description: 'Creative and design roles. Pairs well with fashion, entertainment, and creative industries.', relevantIndustries: ['Clothing', 'Cosmetics', 'Entertainment', 'Video Games', 'Furniture'] },
  { id: 'trade', label: 'Trade Certificate', description: 'Hands-on skilled-trade roles. Pairs well with hospitality, vehicles, and physical-goods industries.', relevantIndustries: ['Furniture', 'Cars', 'Restaurants', 'Food & Beverages'] },
  { id: 'none', label: 'No Degree - Straight to Work', description: 'Skip university and start earning immediately at 16. No tuition years spent, but interviews still decide whether anyone hires you.', relevantIndustries: [] },
]

export function getDegreeProfile(degree: Degree): DegreeProfile {
  const profile = DEGREE_PROFILES.find((d) => d.id === degree)
  if (!profile) throw new Error('Unknown degree: ' + degree)
  return profile
}

export const HARDCORE_JOBS: HardcoreJob[] = [
  { id: 'retail-assistant', title: 'Retail Assistant', employer: 'Northfield General Store', requiredDegree: 'any', annualSalary: 23_000, description: 'Entry-level shop floor and till work - open to anyone who can pass the interview.' },
  { id: 'warehouse-worker', title: 'Warehouse Worker', employer: 'Cedarline Logistics', requiredDegree: 'any', annualSalary: 26_000, description: 'Stock handling and order fulfillment - open to anyone who can show reliability.' },
  { id: 'delivery-driver', title: 'Delivery Driver', employer: 'Swiftpath Courier Co.', requiredDegree: 'any', annualSalary: 27_000, description: 'Local delivery routes - practical, schedule-heavy work.' },
  { id: 'marketing-assistant', title: 'Marketing Assistant', employer: 'Brightwell Consumer Group', requiredDegree: 'business', annualSalary: 36_000, description: 'Supports campaign planning and market research.' },
  { id: 'sales-associate', title: 'Sales Associate', employer: 'Union Retail Partners', requiredDegree: 'business', annualSalary: 34_000, description: 'B2B sales calls and account management.' },
  { id: 'junior-analyst', title: 'Junior Business Analyst', employer: 'Northbridge Financial', requiredDegree: 'business', annualSalary: 42_000, description: 'Spreadsheet-heavy reporting and forecasting support.' },
  { id: 'junior-engineer', title: 'Junior Engineer', employer: 'Vertex Technical Systems', requiredDegree: 'engineering', annualSalary: 48_000, description: 'Supports product design and testing on a technical team.' },
  { id: 'qc-technician', title: 'Quality Control Technician', employer: 'Ironwood Manufacturing', requiredDegree: 'engineering', annualSalary: 40_000, description: 'Tests and inspects manufactured goods before shipment.' },
  { id: 'graphic-designer', title: 'Graphic Designer', employer: 'Silverline Creative Studio', requiredDegree: 'arts-design', annualSalary: 35_000, description: 'Brand and packaging design work for local clients.' },
  { id: 'content-creator', title: 'Content Creator', employer: 'Harbor Media Collective', requiredDegree: 'arts-design', annualSalary: 32_000, description: 'Writes and produces marketing content for small brands.' },
  { id: 'electrician-apprentice', title: "Electrician's Apprentice", employer: 'Crestview Trade Services', requiredDegree: 'trade', annualSalary: 33_000, description: 'Hands-on wiring and installation work under supervision.' },
  { id: 'mechanic', title: 'Mechanic', employer: 'Bluepeak Auto Works', requiredDegree: 'trade', annualSalary: 37_000, description: 'Vehicle maintenance and repair work.' },
]

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getEligibleJobs(degree: Degree): HardcoreJob[] {
  return HARDCORE_JOBS.filter((job) => job.requiredDegree === 'any' || job.requiredDegree === degree)
}

export function getHardcoreJob(jobId: string): HardcoreJob | undefined {
  return HARDCORE_JOBS.find((job) => job.id === jobId)
}

/**
 * Returns the role the player is qualified to interview for. It does not mean
 * they automatically get hired - evaluateJobInterview decides whether an
 * actual offer lands.
 */
export function assignJobByDegreeQuality(degree: Degree, universityQuality: number): HardcoreJob {
  const jobs = getEligibleJobs(degree).sort((a, b) => a.annualSalary - b.annualSalary)
  const index = Math.min(jobs.length - 1, Math.floor((Math.max(0, Math.min(100, universityQuality)) / 100) * jobs.length))
  return jobs[index]
}

export const JOB_INTERVIEW_QUESTIONS: JobInterviewQuestion[] = [
  {
    id: 'opening-story',
    prompt: 'The interviewer asks why you want the role. What do you lead with?',
    options: [
      { label: 'Connect your experience to a real customer or operations problem the employer has.', score: 32, note: 'Clear business fit' },
      { label: 'Say you need money to start a company later.', score: 12, note: 'Honest, but not employer-focused' },
      { label: 'Give a vague answer about being hardworking.', score: 18, note: 'Safe but forgettable' },
    ],
  },
  {
    id: 'pressure',
    prompt: 'They describe a stressful week with missed deadlines. What do you do?',
    options: [
      { label: 'Prioritise the most urgent work, communicate tradeoffs, and ask what must ship first.', score: 30, note: 'Practical judgement' },
      { label: 'Promise to finish everything no matter what.', score: 14, note: 'Sounds confident but unrealistic' },
      { label: 'Wait for a manager to assign every next step.', score: 10, note: 'Too passive for a tough role' },
    ],
  },
  {
    id: 'mistake',
    prompt: 'They ask about a mistake you made. How do you answer?',
    options: [
      { label: 'Own the mistake, explain the fix, and show what system you changed afterwards.', score: 34, note: 'Accountable and realistic' },
      { label: 'Say you rarely make mistakes.', score: 6, note: 'Low trust answer' },
      { label: 'Blame poor instructions and say it was not your fault.', score: 4, note: 'High risk answer' },
    ],
  },
  {
    id: 'numbers',
    prompt: 'They give you a small business problem with messy numbers. What is your approach?',
    options: [
      { label: 'Separate revenue, costs, deadlines, and risks before recommending the next move.', score: 30, note: 'Structured thinking' },
      { label: 'Guess quickly so the conversation keeps moving.', score: 8, note: 'Fast but shallow' },
      { label: 'Ask for the answer because it is not your department yet.', score: 5, note: 'Avoids ownership' },
    ],
  },
]

export function scoreInterviewAnswers(answers: (number | null)[]): number {
  const maxScore = JOB_INTERVIEW_QUESTIONS.reduce((sum, question) => sum + Math.max(...question.options.map((option) => option.score)), 0)
  const score = JOB_INTERVIEW_QUESTIONS.reduce((sum, question, index) => {
    const answer = answers[index]
    if (answer === null || answer === undefined) return sum
    return sum + (question.options[answer]?.score ?? 0)
  }, 0)
  return maxScore > 0 ? clampScore((score / maxScore) * 100) : 0
}

export type CareerInterviewOutcome = {
  passed: boolean
  score: number
  threshold: number
  offerStrength: number
  job: HardcoreJob | null
  feedback: string[]
}

export function evaluateJobInterview(input: { answers: (number | null)[]; degree: Degree; universityQuality: number; industry: Industry }): CareerInterviewOutcome {
  const rawInterviewScore = scoreInterviewAnswers(input.answers)
  const degreeRelevant = isDegreeRelevantToIndustry(input.degree, input.industry)
  const educationSignal = input.degree === 'none' ? Math.min(14, input.universityQuality * 0.14) : input.universityQuality * 0.26
  const relevanceBonus = degreeRelevant ? 7 : 0
  const noDegreeGritBonus = input.degree === 'none' ? 4 : 0
  const score = clampScore(rawInterviewScore * 0.62 + educationSignal + relevanceBonus + noDegreeGritBonus)
  const threshold = input.degree === 'none' ? 52 : degreeRelevant ? 56 : 60
  const passed = score >= threshold
  const placementSignal = clampScore(input.universityQuality * 0.55 + score * 0.45)
  const job = passed ? assignJobByDegreeQuality(input.degree, placementSignal) : null
  const offerStrength = clampScore(20 + score * 0.7 + (degreeRelevant ? 6 : 0) - (input.degree === 'none' ? 0 : 4))
  const feedback: string[] = []

  if (rawInterviewScore >= 80) feedback.push('Strong interview answers made the employer trust your judgement under pressure.')
  if (rawInterviewScore < 55) feedback.push('The interview answers did not show enough ownership or practical judgement yet.')
  if (degreeRelevant) feedback.push('Your degree lines up with the industry you want to build in, which helps your story feel credible.')
  if (input.degree !== 'none' && input.universityQuality < 35) feedback.push('A weak university placement makes the employer look harder at the interview itself.')
  if (!passed) feedback.push('No offer landed. Try a sharper interview strategy before founding a company.')
  if (passed && job) feedback.push('Offer received from ' + job.employer + ': ' + job.title + '.')

  return { passed, score, threshold, offerStrength, job, feedback }
}

export function computeFoundingAge(degree: Degree, yearsWorked: number): number {
  const universityYears = degree === 'none' ? 0 : UNIVERSITY_YEARS
  return STARTING_AGE + universityYears + Math.max(0, Math.min(MAX_YEARS_WORKED, yearsWorked))
}

const ANNUAL_RAISE_RATE = 0.03
const ANNUAL_BASE_HOUSING_AND_BILLS = 10_800
const ANNUAL_BASE_FOOD_AND_TRANSPORT = 6_200

export function computeSimulatedIncomeTax(annualIncome: number): number {
  const income = Math.max(0, annualIncome)
  if (income <= 12_000) return 0
  if (income <= 40_000) return Math.round((income - 12_000) * 0.12)
  if (income <= 80_000) return Math.round(3_360 + (income - 40_000) * 0.22)
  return Math.round(12_160 + (income - 80_000) * 0.3)
}

export function computeCareerFinance(job: HardcoreJob, yearsWorked: number, degree: Degree = 'none', universityQuality = 50): CareerFinanceBreakdown {
  const safeYears = Math.max(0, Math.min(MAX_YEARS_WORKED, Math.floor(yearsWorked)))
  let salary = job.annualSalary
  let grossIncome = 0
  let incomeTax = 0
  let housingAndBills = 0
  let foodAndTransport = 0
  let studentDebtPayments = 0
  let emergencyExpenses = 0
  let netSavings = 0

  for (let year = 0; year < safeYears; year++) {
    const annualSalary = Math.round(salary)
    const tax = computeSimulatedIncomeTax(annualSalary)
    const housing = Math.round(ANNUAL_BASE_HOUSING_AND_BILLS + annualSalary * 0.08)
    const food = Math.round(ANNUAL_BASE_FOOD_AND_TRANSPORT + annualSalary * 0.035)
    const studentDebt = degree === 'none' || universityQuality < 35 ? 0 : Math.round(1_400 + (100 - Math.max(0, Math.min(100, universityQuality))) * 14)
    const emergency = Math.round(annualSalary * 0.025 + (year % 3 === 2 ? 700 : 0))
    const totalDeductionsForYear = tax + housing + food + studentDebt + emergency

    grossIncome += annualSalary
    incomeTax += tax
    housingAndBills += housing
    foodAndTransport += food
    studentDebtPayments += studentDebt
    emergencyExpenses += emergency
    netSavings += Math.max(0, annualSalary - totalDeductionsForYear)
    salary *= 1 + ANNUAL_RAISE_RATE
  }

  const totalExpenses = housingAndBills + foodAndTransport + studentDebtPayments + emergencyExpenses
  const totalDeductions = totalExpenses + incomeTax
  return {
    grossIncome: Math.round(grossIncome),
    incomeTax: Math.round(incomeTax),
    housingAndBills: Math.round(housingAndBills),
    foodAndTransport: Math.round(foodAndTransport),
    studentDebtPayments: Math.round(studentDebtPayments),
    emergencyExpenses: Math.round(emergencyExpenses),
    totalExpenses: Math.round(totalExpenses),
    totalDeductions: Math.round(totalDeductions),
    netSavings: Math.round(netSavings),
    finalSalary: Math.round(salary),
  }
}

export function computeCareerSavings(job: HardcoreJob, yearsWorked: number, degree: Degree = 'none', universityQuality = 50): number {
  return computeCareerFinance(job, yearsWorked, degree, universityQuality).netSavings
}

export const DEGREE_INDUSTRY_REPUTATION_BONUS = 5

export function isDegreeRelevantToIndustry(degree: Degree, industry: Industry): boolean {
  return getDegreeProfile(degree).relevantIndustries.includes(industry)
}
