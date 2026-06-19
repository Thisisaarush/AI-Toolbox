export type ReadingStatus = "not-started" | "reading" | "finished" | "abandoned"

export interface OpenLibraryResult {
  title: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  key: string
}

export interface BookHighlight {
  id: string
  text: string
  page?: number
  note?: string
  createdAt: string
  source?: "manual" | "readwise"
}

export interface Flashcard {
  id: string
  bookId: string
  question: string
  answer: string
  dueDate: string
  interval: number      // days
  easeFactor: number    // SM-2 EF
  repetitions: number
  createdAt: string
}

export interface Book {
  id: string
  title: string
  author: string
  year?: number
  coverUrl?: string
  status: ReadingStatus
  startDate?: string
  finishDate?: string
  genre?: string
  highlights: BookHighlight[]
  notes?: string
  aiSummary?: AISummary
  createdAt: string
  updatedAt: string
}

export interface AISummary {
  keyThemes: string[]
  mainArguments: string[]
  actionItems: string[]
  topQuotes: string[]
  generatedAt: string
}

export interface ReadingStats {
  booksThisYear: number
  avgDaysToFinish: number
  genreBreakdown: Record<string, number>
  readingStreak: number
  totalHighlights: number
}

export type BookNoteAction = "generate-summary" | "generate-flashcards"
