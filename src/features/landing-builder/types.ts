export type LandingTone = "professional" | "casual" | "bold" | "playful" | "minimalist"
export type PricingType = "free" | "freemium" | "paid" | "usage-based" | "enterprise"

export interface LandingInput {
  productName: string
  oneLiner: string
  targetAudience: string
  features: string[]
  pricingType: PricingType
  tone: LandingTone
  competitor?: string
}

export interface HeroSection {
  headline: string
  subheadline: string
  ctaPrimary: string
  ctaSecondary: string
  socialProof: string
}

export interface FeatureItem {
  title: string
  description: string
  icon: string
}

export interface HowItWorksStep {
  step: number
  title: string
  description: string
}

export interface Testimonial {
  quote: string
  author: string
  role: string
  company: string
}

export interface PricingTier {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  highlighted: boolean
}

export interface FAQItem {
  question: string
  answer: string
}

export interface CTASection {
  headline: string
  subtext: string
  buttonText: string
}

export interface SEOSection {
  metaTitle: string
  metaDescription: string
  keywords: string[]
  ogTitle: string
  ogDescription: string
}

export interface LandingOutput {
  hero: HeroSection
  features: FeatureItem[]
  howItWorks: HowItWorksStep[]
  testimonials: Testimonial[]
  pricing: PricingTier[]
  faq: FAQItem[]
  cta: CTASection
  seo: SEOSection
}

export interface LandingRecord {
  id: string
  input: LandingInput
  output: LandingOutput
  createdAt: string
}

export const TONE_LABELS: Record<LandingTone, string> = {
  professional: "Professional",
  casual: "Casual & Friendly",
  bold: "Bold & Direct",
  playful: "Playful & Fun",
  minimalist: "Minimalist",
}

export const PRICING_LABELS: Record<PricingType, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "usage-based": "Usage-Based",
  enterprise: "Enterprise",
}
