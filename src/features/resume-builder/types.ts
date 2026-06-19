// Resume data types
export interface ResumeSection {
  id: string
  type: 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'summary'
}

export interface Experience {
  id: string
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa?: string
}

export interface Project {
  id: string
  name: string
  description: string
  bullets: string[]
  url?: string
  tech: string[]
}

export interface Resume {
  id: string
  name: string // resume name, not person's name
  fullName: string
  email: string
  phone: string
  location: string
  linkedin?: string
  github?: string
  website?: string
  summary: string
  experience: Experience[]
  education: Education[]
  skills: string[]
  projects: Project[]
  certifications: Array<{ id: string; name: string; issuer: string; date: string }>
  template: 'classic' | 'modern' | 'minimal'
  createdAt: string
  updatedAt: string
}

export interface ATSScore {
  overall: number
  breakdown: {
    atsReadability: number    // /25
    contentQuality: number   // /35
    writingQuality: number   // /10
    jobMatch: number         // /25 (0 if no job description)
    applicationReady: number // /5
  }
  strengths: string[]
  improvements: string[]
  missingKeywords: string[]
  recommendedBulletRewrites: Array<{ original: string; rewritten: string }>
}

export interface TailoredBullet {
  section: string
  itemId: string
  bulletIndex: number
  original: string
  rewritten: string
}

export interface TailorResult {
  tailoredBullets: TailoredBullet[]
  suggestedSkills: string[]
  tailoredSummary: string
}

export interface BulletRewrites {
  conservative: string
  moderate: string
  aggressive: string
}
