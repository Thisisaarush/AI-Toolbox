export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SRV" | "CAA"

export interface DNSRecord {
  id: string
  type: RecordType
  name: string
  value: string
  ttl: number
  priority?: number
  notes?: string
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
}

export interface PropagationResult {
  resolver: string
  ip: string
  location: string
  answer: string[]
  status: "ok" | "error" | "pending"
  responseTime?: number
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
