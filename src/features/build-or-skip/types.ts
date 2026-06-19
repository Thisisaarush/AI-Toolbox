export type Verdict = "BUILD" | "SKIP" | "PIVOT"

export interface BuildOrSkipInput {
  idea: string
  timeAvailable: string
  skills: string
  goal: string
}

export interface BuildOrSkipResult {
  verdict: Verdict
  confidence: number
  headline: string
  snarkyQuote: string
  for: string[]
  against: string[]
  risks: string[]
  prediction: string
  pivotSuggestion?: string
}

export interface BuildOrSkipRecord {
  id: string
  input: BuildOrSkipInput
  result: BuildOrSkipResult
  createdAt: string
}

export const LOADING_MESSAGES = [
  "Consulting the build gods...",
  "Running the idea through the hype filter...",
  "Checking if this already exists on Product Hunt...",
  "Calculating your opportunity cost...",
  "Asking senior devs on Twitter...",
  "Measuring the cringe-to-value ratio...",
  "Estimating months until burnout...",
  "Checking if this is just Excel with extra steps...",
  "Comparing against 47 similar failed startups...",
  "Stress-testing your conviction...",
]
