export type SplitType = "equal" | "percentage" | "fixed" | "self-paid"
export type ExpenseCategory = "food" | "transport" | "accommodation" | "activities" | "shopping" | "utilities" | "other"

export interface Member {
  id: string
  name: string
}

export interface SplitAllocation {
  memberId: string
  value: number   // percentage (0-100) or fixed amount, depending on splitType
}

export interface Expense {
  id: string
  groupId: string
  description: string
  amount: number
  currency: string
  paidById: string
  splitType: SplitType
  allocations?: SplitAllocation[]   // for percentage/fixed splits
  selfPaidMemberId?: string          // for self-paid: this person pays only for themselves
  category: ExpenseCategory
  date: string
  notes?: string
}

export interface Settlement {
  id: string
  groupId: string
  fromId: string
  toId: string
  amount: number
  currency: string
  paid: boolean
  paidAt?: string
}

export interface Group {
  id: string
  name: string
  description?: string
  members: Member[]
  currency: string
  status: "active" | "settled"
  createdAt: string
  settledAt?: string
}

export interface SplitterStore {
  groups: Group[]
  expenses: Expense[]
  settlements: Settlement[]
}

export const CATEGORIES: ExpenseCategory[] = [
  "food","transport","accommodation","activities","shopping","utilities","other"
]

export const CAT_EMOJI: Record<ExpenseCategory, string> = {
  food: "🍔",
  transport: "🚗",
  accommodation: "🏨",
  activities: "🎯",
  shopping: "🛍",
  utilities: "💡",
  other: "📦",
}

export const CAT_COLORS: Record<ExpenseCategory, string> = {
  food:          "text-orange-400",
  transport:     "text-blue-400",
  accommodation: "text-purple-400",
  activities:    "text-green-400",
  shopping:      "text-pink-400",
  utilities:     "text-gray-400",
  other:         "text-muted-foreground",
}

// ── Settlement calculation ────────────────────────────────────────────────────

interface NetBalance {
  memberId: string
  name: string
  net: number // positive = owed money, negative = owes money
}

export function calculateSettlements(group: Group, expenses: Expense[]): { from: Member; to: Member; amount: number }[] {
  // Build net balances
  const balances = new Map<string, number>()
  group.members.forEach((m) => balances.set(m.id, 0))

  for (const expense of expenses) {
    if (expense.groupId !== group.id) continue
    const amount = expense.amount
    const payer = expense.paidById

    switch (expense.splitType) {
      case "equal": {
        const share = amount / group.members.length
        group.members.forEach((m) => {
          if (m.id === payer) {
            balances.set(m.id, (balances.get(m.id) ?? 0) + amount - share)
          } else {
            balances.set(m.id, (balances.get(m.id) ?? 0) - share)
          }
        })
        break
      }
      case "percentage": {
        const allocs = expense.allocations ?? []
        group.members.forEach((m) => {
          const alloc = allocs.find((a) => a.memberId === m.id)
          const share = alloc ? (alloc.value / 100) * amount : 0
          if (m.id === payer) {
            balances.set(m.id, (balances.get(m.id) ?? 0) + amount - share)
          } else {
            balances.set(m.id, (balances.get(m.id) ?? 0) - share)
          }
        })
        break
      }
      case "fixed": {
        const allocs = expense.allocations ?? []
        group.members.forEach((m) => {
          const alloc = allocs.find((a) => a.memberId === m.id)
          const share = alloc ? alloc.value : 0
          if (m.id === payer) {
            balances.set(m.id, (balances.get(m.id) ?? 0) + amount - share)
          } else {
            balances.set(m.id, (balances.get(m.id) ?? 0) - share)
          }
        })
        break
      }
      case "self-paid": {
        // Payer pays for themselves, others split the rest equally
        const others = group.members.filter((m) => m.id !== payer)
        if (others.length === 0) break
        const othersShare = amount / (others.length + 1) * others.length
        const payerOwnShare = amount / (others.length + 1)
        // Payer paid full amount but only owes their own share
        balances.set(payer, (balances.get(payer) ?? 0) + othersShare)
        others.forEach((m) => {
          const share = othersShare / others.length
          balances.set(m.id, (balances.get(m.id) ?? 0) - share)
        })
        void payerOwnShare
        break
      }
    }
  }

  // Greedy debt simplification
  const credits: NetBalance[] = []
  const debts: NetBalance[] = []
  balances.forEach((net, memberId) => {
    const member = group.members.find((m) => m.id === memberId)!
    if (net > 0.005) credits.push({ memberId, name: member.name, net })
    else if (net < -0.005) debts.push({ memberId, name: member.name, net: Math.abs(net) })
  })

  credits.sort((a, b) => b.net - a.net)
  debts.sort((a, b) => b.net - a.net)

  const result: { from: Member; to: Member; amount: number }[] = []
  let ci = 0, di = 0

  while (ci < credits.length && di < debts.length) {
    const credit = credits[ci]!
    const debt = debts[di]!
    const amount = Math.min(credit.net, debt.net)

    result.push({
      from: group.members.find((m) => m.id === debt.memberId)!,
      to: group.members.find((m) => m.id === credit.memberId)!,
      amount: Math.round(amount * 100) / 100,
    })

    credit.net -= amount
    debt.net -= amount

    if (credit.net < 0.005) ci++
    if (debt.net < 0.005) di++
  }

  return result
}

export function getCategoryPieData(expenses: Expense[]): { category: ExpenseCategory; amount: number; pct: number }[] {
  const map = new Map<ExpenseCategory, number>()
  expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount, pct: Math.round((amount / total) * 100) }))
    .sort((a, b) => b.amount - a.amount)
}
