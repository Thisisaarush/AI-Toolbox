import type { ContractField, ContractType } from "./types"

export const CONTRACT_FIELDS: Record<ContractType, ContractField[]> = {
  "nda-mutual": [
    { key: "party1Name", label: "Party 1 Name", type: "text", placeholder: "Acme Corp", required: true },
    { key: "party1Address", label: "Party 1 Address", type: "text", placeholder: "123 Main St, City" },
    { key: "party2Name", label: "Party 2 Name", type: "text", placeholder: "Beta LLC", required: true },
    { key: "party2Address", label: "Party 2 Address", type: "text", placeholder: "456 Oak Ave, City" },
    { key: "effectiveDate", label: "Effective Date", type: "date", required: true },
    { key: "purpose", label: "Purpose of Disclosure", type: "textarea", placeholder: "Exploring a potential business partnership" },
    { key: "duration", label: "NDA Duration (years)", type: "number", placeholder: "2" },
    { key: "state", label: "Governing State/Province", type: "text", placeholder: "California" },
  ],
  "nda-one-way": [
    { key: "disclosingParty", label: "Disclosing Party", type: "text", placeholder: "Company Inc", required: true },
    { key: "receivingParty", label: "Receiving Party", type: "text", placeholder: "Consultant LLC", required: true },
    { key: "effectiveDate", label: "Effective Date", type: "date", required: true },
    { key: "purpose", label: "Purpose of Disclosure", type: "textarea", placeholder: "Evaluating software solution" },
    { key: "duration", label: "NDA Duration (years)", type: "number", placeholder: "2" },
    { key: "state", label: "Governing State/Province", type: "text", placeholder: "New York" },
  ],
  "freelance-service": [
    { key: "clientName", label: "Client Name", type: "text", required: true },
    { key: "clientAddress", label: "Client Address", type: "text" },
    { key: "freelancerName", label: "Freelancer Name", type: "text", required: true },
    { key: "freelancerAddress", label: "Freelancer Address", type: "text" },
    { key: "services", label: "Services Description", type: "textarea", placeholder: "Web development, UI/UX design...", required: true },
    { key: "rate", label: "Rate / Total Fee", type: "text", placeholder: "$150/hr or $5,000 fixed", required: true },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "endDate", label: "End Date / Deadline", type: "date" },
    { key: "paymentTerms", label: "Payment Terms", type: "text", placeholder: "Net 30, 50% upfront..." },
    { key: "revisions", label: "Included Revisions", type: "number", placeholder: "2" },
    { key: "state", label: "Governing State", type: "text" },
  ],
  "sow": [
    { key: "clientName", label: "Client Name", type: "text", required: true },
    { key: "vendorName", label: "Vendor / Contractor", type: "text", required: true },
    { key: "projectName", label: "Project Name", type: "text", required: true },
    { key: "projectDescription", label: "Project Description", type: "textarea", required: true },
    { key: "deliverables", label: "Deliverables", type: "textarea", placeholder: "1. Mobile app...\n2. Admin panel..." },
    { key: "timeline", label: "Timeline", type: "text", placeholder: "12 weeks starting Jan 1" },
    { key: "totalBudget", label: "Total Budget", type: "text" },
    { key: "milestones", label: "Payment Milestones", type: "textarea" },
    { key: "acceptanceCriteria", label: "Acceptance Criteria", type: "textarea" },
  ],
  "ip-assignment": [
    { key: "assignorName", label: "Assignor (Creator)", type: "text", required: true },
    { key: "assigneeName", label: "Assignee (Receiving Party)", type: "text", required: true },
    { key: "workDescription", label: "IP / Work Description", type: "textarea", required: true },
    { key: "consideration", label: "Consideration ($)", type: "text", placeholder: "$1 or agreed amount" },
    { key: "effectiveDate", label: "Effective Date", type: "date" },
    { key: "state", label: "Governing State", type: "text" },
  ],
  "employment-offer": [
    { key: "employerName", label: "Employer Name", type: "text", required: true },
    { key: "employeeName", label: "Employee Name", type: "text", required: true },
    { key: "jobTitle", label: "Job Title", type: "text", required: true },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "salary", label: "Annual Salary", type: "text", required: true },
    { key: "benefits", label: "Benefits", type: "textarea", placeholder: "Health insurance, 401k, PTO..." },
    { key: "reportingTo", label: "Reports To", type: "text" },
    { key: "location", label: "Work Location", type: "text", placeholder: "Remote / San Francisco, CA" },
    { key: "offerExpiry", label: "Offer Expiry Date", type: "date" },
    { key: "state", label: "Governing State", type: "text" },
  ],
  "tos": [
    { key: "companyName", label: "Company Name", type: "text", required: true },
    { key: "websiteUrl", label: "Website URL", type: "text", required: true },
    { key: "contactEmail", label: "Contact Email", type: "text", required: true },
    { key: "serviceDescription", label: "Service Description", type: "textarea" },
    { key: "jurisdiction", label: "Jurisdiction / Governing Law", type: "text" },
    { key: "effectiveDate", label: "Effective Date", type: "date" },
  ],
  "privacy-policy": [
    { key: "companyName", label: "Company Name", type: "text", required: true },
    { key: "websiteUrl", label: "Website URL", type: "text", required: true },
    { key: "contactEmail", label: "Privacy Contact Email", type: "text", required: true },
    { key: "dataCollected", label: "Data Types Collected", type: "textarea", placeholder: "Email, name, usage analytics..." },
    { key: "thirdParties", label: "Third Party Services", type: "text", placeholder: "Google Analytics, Stripe..." },
    { key: "retentionPeriod", label: "Data Retention Period", type: "text", placeholder: "2 years" },
    { key: "effectiveDate", label: "Effective Date", type: "date" },
  ],
  "consulting": [
    { key: "consultantName", label: "Consultant Name", type: "text", required: true },
    { key: "clientName", label: "Client Name", type: "text", required: true },
    { key: "servicesScope", label: "Consulting Services Scope", type: "textarea", required: true },
    { key: "rate", label: "Consulting Rate", type: "text", placeholder: "$200/hr or $10,000/month" },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "endDate", label: "End Date", type: "date" },
    { key: "paymentTerms", label: "Payment Terms", type: "text" },
    { key: "expensesPolicy", label: "Expense Reimbursement", type: "text", placeholder: "Pre-approved expenses reimbursed" },
    { key: "state", label: "Governing State", type: "text" },
  ],
  "contractor": [
    { key: "contractorName", label: "Contractor Name", type: "text", required: true },
    { key: "contractorAddress", label: "Contractor Address", type: "text" },
    { key: "companyName", label: "Company Name", type: "text", required: true },
    { key: "servicesDescription", label: "Services Description", type: "textarea", required: true },
    { key: "compensation", label: "Compensation", type: "text", required: true },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "endDate", label: "End Date", type: "date" },
    { key: "paymentTerms", label: "Payment Terms", type: "text" },
    { key: "equipmentPolicy", label: "Equipment / Tools", type: "text", placeholder: "Contractor provides own equipment" },
    { key: "state", label: "Governing State", type: "text" },
  ],
}

export function getSystemPrompt(contractType: string, jurisdiction: string): string {
  const jurisdictionNotes: Record<string, string> = {
    us: "Use US legal terminology. Include at-will employment clauses where applicable. Follow UCC and common law principles.",
    uk: "Use UK legal terminology (e.g., 'whilst', 'hereunder'). Reference English law. Include GDPR compliance where applicable.",
    eu: "Apply EU law principles. Ensure GDPR compliance. Use formal European legal terminology.",
    india: "Use Indian legal terminology. Reference Indian Contract Act, 1872. Include jurisdiction as Indian courts.",
    canada: "Use Canadian legal terminology. Consider federal and provincial laws. Reference appropriate provincial jurisdiction.",
    australia: "Use Australian legal terminology. Reference Australian Consumer Law and relevant Acts. Use Australian English.",
  }

  return `You are an expert legal document drafter with 20+ years of experience. Generate a complete, professional, legally-structured ${contractType} for ${jurisdiction} jurisdiction.

${jurisdictionNotes[jurisdiction] ?? ""}

The document should:
1. Have a proper legal header with title and parties
2. Include all standard protective clauses
3. Use clear, unambiguous language
4. Include numbered sections and subsections
5. Include governing law, dispute resolution, and severability clauses
6. Be comprehensive but not overly verbose
7. Include signature blocks at the end

Format as plain text with proper legal document structure.`
}
