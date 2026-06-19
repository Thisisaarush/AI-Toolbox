export type QuestionCategory =
  | "behavioral" | "system-design" | "dsa" | "culture-fit"
  | "salary-negotiation" | "custom"

export type Difficulty = "easy" | "medium" | "hard"

export interface Question {
  id: string
  category: QuestionCategory
  difficulty: Difficulty
  question: string
  tips?: string
  starTemplate?: boolean
  custom?: boolean
}

export interface STARAnswer {
  situation: string
  task: string
  action: string
  result: string
}

export interface FlashcardState {
  questionId: string
  confidence: 1 | 2 | 3   // 1=hard, 2=ok, 3=easy
  nextReview: string       // ISO
  reviewCount: number
}

export interface PracticeSession {
  id: string
  questionId: string
  answer: string
  feedback?: AiFeedback
  starAnswer?: STARAnswer
  timestamp: string
}

export interface AiFeedback {
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  modelAnswer?: string
  score?: number   // 0-10
}

export interface MockInterviewSession {
  id: string
  categories: QuestionCategory[]
  difficulty: Difficulty
  timePerQuestion: number   // minutes
  questions: string[]       // question ids
  answers: Record<string, string>
  feedback?: Record<string, AiFeedback>
  overallScore?: number
  improvementPlan?: string
  startedAt: string
  completedAt?: string
}

export interface CompanyResearch {
  id: string
  company: string
  format?: string
  values?: string[]
  commonQuestions?: string[]
  talkingPoints?: string[]
  createdAt: string
}

export interface ProgressTracker {
  totalSessions: number
  byCategory: Record<QuestionCategory, { practiced: number; avgConfidence: number }>
  readinessScore: number
  lastPracticed?: string
}

export interface InterviewStore {
  sessions: PracticeSession[]
  flashcards: FlashcardState[]
  mocks: MockInterviewSession[]
  companyResearch: CompanyResearch[]
  customQuestions: Question[]
}

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  behavioral:           "Behavioral",
  "system-design":      "System Design",
  dsa:                  "DSA",
  "culture-fit":        "Culture Fit",
  "salary-negotiation": "Salary Negotiation",
  custom:               "Custom",
}

export const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  behavioral:           "bg-blue-500/20 text-blue-400",
  "system-design":      "bg-purple-500/20 text-purple-400",
  dsa:                  "bg-green-500/20 text-green-400",
  "culture-fit":        "bg-amber-500/20 text-amber-400",
  "salary-negotiation": "bg-emerald-500/20 text-emerald-400",
  custom:               "bg-gray-500/20 text-gray-400",
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy:   "bg-green-500/20 text-green-400",
  medium: "bg-amber-500/20 text-amber-400",
  hard:   "bg-red-500/20 text-red-400",
}

export const RESOURCES: Record<QuestionCategory, { title: string; url: string; desc: string }[]> = {
  behavioral: [
    { title: "STAR Method Guide", url: "https://www.themuse.com/advice/star-interview-method", desc: "Complete STAR framework guide" },
    { title: "Top 30 Behavioral Questions", url: "https://www.indeed.com/career-advice/interviewing/most-common-behavioral-interview-questions", desc: "With sample answers" },
  ],
  "system-design": [
    { title: "Designing Data-Intensive Applications", url: "https://dataintensive.net/", desc: "The definitive book by Martin Kleppmann" },
    { title: "Grokking System Design", url: "https://www.educative.io/courses/grokking-the-system-design-interview", desc: "Popular course on Educative" },
    { title: "System Design Primer (GitHub)", url: "https://github.com/donnemartin/system-design-primer", desc: "Free open-source guide" },
    { title: "ByteByteGo", url: "https://bytebytego.com/", desc: "Visual system design explanations" },
  ],
  dsa: [
    { title: "LeetCode", url: "https://leetcode.com/", desc: "Practice problems with solutions" },
    { title: "NeetCode", url: "https://neetcode.io/", desc: "Curated 150 problems + video solutions" },
    { title: "Introduction to Algorithms (CLRS)", url: "https://mitpress.mit.edu/9780262046305/", desc: "The classic algorithms textbook" },
    { title: "Blind 75", url: "https://neetcode.io/practice", desc: "The famous 75 must-do problems" },
  ],
  "culture-fit": [
    { title: "Research Company Values", url: "https://www.glassdoor.com/", desc: "Reviews from real employees" },
    { title: "Culture Amp Blog", url: "https://www.cultureamp.com/blog/", desc: "Understanding modern work culture" },
  ],
  "salary-negotiation": [
    { title: "Levels.fyi", url: "https://www.levels.fyi/", desc: "Real compensation data by company and level" },
    { title: "Haseeb Qureshi on Negotiation", url: "https://haseebq.com/my-ten-rules-for-negotiating-a-job-offer/", desc: "Famous blog post on negotiating" },
    { title: "Glassdoor Salaries", url: "https://www.glassdoor.com/Salaries/", desc: "Salary ranges by role and company" },
  ],
  custom: [],
}
