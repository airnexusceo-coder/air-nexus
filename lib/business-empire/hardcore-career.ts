import type { Degree, DegreeProfile, EntranceQuizQuestion, HardcoreJob, Industry } from '@/lib/business-empire/types'

/**
 * Hardcore Mode's pre-game career phase: the player starts in high school
 * and takes a single entrance quiz. Their score determines which university
 * they place into — not a choice. They then pick a degree subject (the one
 * real choice in this phase), and their job is assigned automatically from
 * how strong that degree turned out to be — the player never picks their
 * profession directly. They only choose how many years to work it (up to
 * 10) before founding the company, trading more starting capital for less
 * time to grow the business itself.
 */

export const STARTING_AGE = 16
/** Added to age only if the player pursues a degree (chooses anything other than 'none'). */
export const UNIVERSITY_YEARS = 3
export const MAX_YEARS_WORKED = 10

export const UNIVERSITY_ENTRANCE_QUIZ: EntranceQuizQuestion[] = [
  { id: 'profit', prompt: 'A business sells a product for $50 that costs $30 to make. What is the profit per unit?', options: ['$30', '$20', '$50', '$80'], correctIndex: 1 },
  { id: 'net-profit', prompt: "A company's revenue is $100,000 and its expenses are $85,000. What is its net profit?", options: ['$85,000', '$100,000', '$15,000', '$185,000'], correctIndex: 2 },
  { id: 'market-share', prompt: "What does 'market share' measure?", options: ['A company’s percentage of total sales in its industry', 'How many products a company sells', 'A company’s total profit', 'The number of employees a company has'], correctIndex: 0 },
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
  { id: 'none', label: 'No Degree — Straight to Work', description: 'Skip university and start earning immediately at 16. No tuition years spent, but only entry-level jobs are open, and your quiz score still decides which one.', relevantIndustries: [] },
]

export function getDegreeProfile(degree: Degree): DegreeProfile {
  const profile = DEGREE_PROFILES.find((d) => d.id === degree)
  if (!profile) throw new Error(`Unknown degree: ${degree}`)
  return profile
}

export const HARDCORE_JOBS: HardcoreJob[] = [
  { id: 'retail-assistant', title: 'Retail Assistant', employer: 'Northfield General Store', requiredDegree: 'any', annualSalary: 23_000, description: 'Entry-level shop floor and till work — open to anyone.' },
  { id: 'warehouse-worker', title: 'Warehouse Worker', employer: 'Cedarline Logistics', requiredDegree: 'any', annualSalary: 26_000, description: 'Stock handling and order fulfillment — open to anyone.' },
  { id: 'delivery-driver', title: 'Delivery Driver', employer: 'Swiftpath Courier Co.', requiredDegree: 'any', annualSalary: 27_000, description: 'Local delivery routes — open to anyone with a license.' },
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

function getEligibleJobs(degree: Degree): HardcoreJob[] {
  return HARDCORE_JOBS.filter((job) => job.requiredDegree === 'any' || job.requiredDegree === degree)
}

export function getHardcoreJob(jobId: string): HardcoreJob | undefined {
  return HARDCORE_JOBS.find((job) => job.id === jobId)
}

/**
 * The player never picks a job — it's assigned from how strong their degree
 * turned out to be. Jobs open to a degree are ranked by salary, and the
 * quiz-driven quality (0-100) selects a position along that ranking: a top
 * university placement lands the best job that degree opens up; a weak one
 * lands the most basic job in the same eligible pool. This is deterministic,
 * never a dice roll — the only randomness in the outcome came from the
 * player's own quiz answers.
 */
export function assignJobByDegreeQuality(degree: Degree, universityQuality: number): HardcoreJob {
  const jobs = getEligibleJobs(degree).sort((a, b) => a.annualSalary - b.annualSalary)
  const index = Math.min(jobs.length - 1, Math.floor((Math.max(0, Math.min(100, universityQuality)) / 100) * jobs.length))
  return jobs[index]
}

export function computeFoundingAge(degree: Degree, yearsWorked: number): number {
  const universityYears = degree === 'none' ? 0 : UNIVERSITY_YEARS
  return STARTING_AGE + universityYears + Math.max(0, Math.min(MAX_YEARS_WORKED, yearsWorked))
}

const ANNUAL_LIVING_COST = 18_000
const ANNUAL_RAISE_RATE = 0.03

/**
 * Deterministic — no dice roll decides how much a player saves, only the
 * job they were assigned and how many years they choose to work it. Salary
 * gets a small compounding raise each year, rewarding working longer
 * non-linearly, while a fixed annual living cost is deducted before
 * anything is saved.
 */
export function computeCareerSavings(job: HardcoreJob, yearsWorked: number): number {
  if (yearsWorked <= 0) return 0
  let savings = 0
  let salary = job.annualSalary
  for (let year = 0; year < yearsWorked; year++) {
    savings += Math.max(0, salary - ANNUAL_LIVING_COST)
    salary *= 1 + ANNUAL_RAISE_RATE
  }
  return Math.round(savings)
}

export const DEGREE_INDUSTRY_REPUTATION_BONUS = 5

/** Whether the founder's degree is relevant to the industry they're founding a company in — used for a small, explained starting-reputation bonus, never a guarantee of success. */
export function isDegreeRelevantToIndustry(degree: Degree, industry: Industry): boolean {
  return getDegreeProfile(degree).relevantIndustries.includes(industry)
}
