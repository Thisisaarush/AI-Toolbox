export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SRV" | "CAA"

export interface DNSRecord {
  id: string
  type: RecordType
  name: string
  value: string
  ttl: number
  priority?: number
  notes?: string
  ptrResult?: string | null
}

export interface SSLInfo {
  issuer: string
  validFrom: string
  validTo: string
  daysUntilExpiry: number
  isValid: boolean
  certName?: string
}

export interface DomainHealthCache {
  https: boolean
  sslDays: number | null
  lastChecked: string
}

export interface Domain {
  id: string
  name: string
  registrar: string
  expiryDate: string
  autoRenewal: boolean
  nameservers: string[]
  records: DNSRecord[]
  notes: string
  cloudflareZoneId?: string
  isCloudflare: boolean
  createdAt: string
  updatedAt: string
  sslInfo?: SSLInfo | null
  whoisInfo?: WhoisInfo | null
  healthCache?: DomainHealthCache | null
}

export interface WhoisInfo {
  registrar?: string
  creationDate?: string
  expiryDate?: string
  nameServers?: string[]
  whoisUrl: string
  raw?: string
}

export interface PropagationResult {
  resolver: string
  ip: string
  location: string
  answer: string[]
  status: "ok" | "error" | "pending"
  responseTime?: number
}

export interface DnsDiffRecord {
  type: RecordType
  name: string
  value: string
}

export interface DnsDiffResult {
  onlyInA: DnsDiffRecord[]
  onlyInB: DnsDiffRecord[]
  different: Array<{ name: string; type: RecordType; valueA: string; valueB: string }>
  identical: DnsDiffRecord[]
}

export const RECORD_TYPE_DESCRIPTIONS: Record<RecordType, string> = {
  A: "Maps a domain to an IPv4 address. The most common record type — points your domain to a server.",
  AAAA: "Maps a domain to an IPv6 address. Like an A record but for the modern IPv6 internet.",
  CNAME: "Alias record — points your domain to another domain name instead of an IP address. Common for www subdomains.",
  MX: "Mail Exchange record — tells email servers where to deliver email for your domain.",
  TXT: "Text record — used for domain verification (Google, Stripe, etc.) and SPF/DKIM email authentication.",
  NS: "Name Server record — delegates a domain or subdomain to a specific DNS server.",
  SRV: "Service record — specifies the location of servers for specific services (VoIP, game servers, etc.).",
  CAA: "Certificate Authority Authorization — controls which CAs can issue SSL certificates for your domain.",
}

// Record type pill colours (Tailwind classes)
export const RECORD_TYPE_COLORS: Record<RecordType, string> = {
  A: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CNAME: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MX: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  TXT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  NS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  AAAA: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  SRV: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  CAA: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}

export interface DNSTemplate {
  id: string
  label: string
  description: string
  records: Omit<DNSRecord, "id">[]
}

export const DNS_TEMPLATES: DNSTemplate[] = [
  {
    id: "vercel",
    label: "Vercel Deployment",
    description: "Point your domain to Vercel",
    records: [
      { type: "A", name: "@", value: "76.76.21.21", ttl: 3600 },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com", ttl: 3600 },
    ],
  },
  {
    id: "resend",
    label: "Resend Email",
    description: "Set up transactional email with Resend",
    records: [
      { type: "MX", name: "send", value: "feedback-smtp.us-east-1.amazonses.com", ttl: 300, priority: 10 },
      { type: "TXT", name: "resend._domainkey", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4...(your DKIM key)", ttl: 3600 },
      { type: "TXT", name: "@", value: "v=spf1 include:amazonses.com ~all", ttl: 3600 },
    ],
  },
  {
    id: "github-pages",
    label: "GitHub Pages",
    description: "Host your site on GitHub Pages",
    records: [
      { type: "A", name: "@", value: "185.199.108.153", ttl: 3600 },
      { type: "A", name: "@", value: "185.199.109.153", ttl: 3600 },
      { type: "A", name: "@", value: "185.199.110.153", ttl: 3600 },
      { type: "A", name: "@", value: "185.199.111.153", ttl: 3600 },
      { type: "CNAME", name: "www", value: "yourusername.github.io", ttl: 3600 },
    ],
  },
  {
    id: "cloudflare-pages",
    label: "Cloudflare Pages",
    description: "Deploy with Cloudflare Pages",
    records: [
      { type: "CNAME", name: "@", value: "your-project.pages.dev", ttl: 1 },
      { type: "CNAME", name: "www", value: "your-project.pages.dev", ttl: 1 },
    ],
  },
  {
    id: "custom-email-mx",
    label: "Custom Email MX",
    description: "Generic MX records for custom email",
    records: [
      { type: "MX", name: "@", value: "mail.yourdomain.com", ttl: 3600, priority: 10 },
      { type: "TXT", name: "@", value: "v=spf1 mx ~all", ttl: 3600 },
    ],
  },
]

export function getDaysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  const now = new Date()
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getExpiryColor(days: number): string {
  if (days < 0) return "text-red-600"
  if (days < 30) return "text-red-500"
  if (days < 90) return "text-amber-500"
  return "text-green-500"
}

export function getExpiryBadgeColor(days: number | null): string {
  if (days === null) return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
  if (days < 0) return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
  if (days < 30) return "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
  if (days < 90) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
  return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
}

// Domain portfolio value estimator
export function estimateDomainValue(domainName: string): number {
  const parts = domainName.split(".")
  const tld = parts.slice(-1)[0] ?? ""
  const sld = parts.slice(0, -1).join(".")
  const wordParts = sld.split(/[-_]/)

  let value = 100 // base

  // TLD multiplier
  const tldMultipliers: Record<string, number> = {
    com: 10, net: 4, org: 3, io: 5, co: 4, app: 4, ai: 8, dev: 3,
  }
  value *= tldMultipliers[tld] ?? 1

  // Length bonus (shorter = more)
  if (sld.length <= 4) value *= 5
  else if (sld.length <= 6) value *= 3
  else if (sld.length <= 8) value *= 2
  else if (sld.length <= 12) value *= 1.5

  // Single word bonus
  if (wordParts.length === 1) value *= 2

  return Math.round(value)
}
