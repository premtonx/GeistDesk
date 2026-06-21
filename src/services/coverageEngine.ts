import { GoogleGenAI } from "@google/genai";
import { getDocsDirect, setDocDirect, getDocDirect } from '../lib/postgres-backend';

export interface ExpectedTopic {
  id: string;
  title: string;
  description: string;
  required: boolean;
  matchKeywords: string[];
  matched?: boolean;
  matchedArticleId?: string | null;
}

export interface CategoryCoverage {
  id: string;
  categoryName: string;
  expectedTopics: ExpectedTopic[];
  existingArticles: any[];
  missingArticles: ExpectedTopic[];
  coveragePercentage: number;
  documentationHealth: 'Excellent' | 'Good' | 'Critical';
  lastCalculated: string;
}

export interface CoverageDashboard {
  overallCoverage: number;
  totalArticles: number;
  totalMissing: number;
  health: 'Excellent' | 'Good' | 'Critical';
  criticalGaps: { topic: string; category: string; priority: 'High' | 'Medium'; reason: string }[];
  categorySummaries: { categoryName: string; coverage: number; health: string; existingCount: number; missingCount: number }[];
  aiSuggestions: { title: string; category: string; reason: string; priority: 'High' | 'Medium'; matchedTicketId?: string }[];
}

// Default expected topics structure
export const DEFAULT_EXPECTED_TOPICS: { [category: string]: Omit<ExpectedTopic, "matched" | "matchedArticleId">[] } = {
  "Getting Started": [
    { id: "gs-setup", title: "Setup Guide", description: "Essential first-step documentation for deploying core nodes.", required: true, matchKeywords: ["setup", "getting started", "welcome", "installation", "navigating"] },
    { id: "gs-onboarding", title: "User Onboarding Guide", description: "Inviting team members and assigning roles recursively.", required: true, matchKeywords: ["onboarding", "inviting", "member", "managing team", "provisioning"] },
    { id: "gs-basics", title: "Basics & Navigation Guide", description: "General walk-through tour around dashboards.", required: false, matchKeywords: ["basics", "interface overview", "navigation", "navigating"] },
    { id: "gs-dr", title: "Disaster Recovery Guide", description: "Sovereign backup restoration procedures and recovery timelines.", required: false, matchKeywords: ["disaster", "recovery", "dr plan", "restoration", "backup"] }
  ],
  "Billing": [
    { id: "bil-invoice", title: "Invoicing Methods Guide", description: "Accessing and downloading enterprise invoice clear copies.", required: true, matchKeywords: ["invoice", "download", "receipt", "billing plan"] },
    { id: "bil-pricing", title: "Plans and Pricing FAQ", description: "Subscription tier capabilities and LLM tokens quotas.", required: true, matchKeywords: ["plans", "pricing", "pricing plan", "billing tier", "subscription"] },
    { id: "bil-cancel", title: "Subscription Cancelation Policy", description: "Terms and conditions of offboarding and data retention.", required: false, matchKeywords: ["cancel", "cancelation", "refund", "terms", "termination"] },
    { id: "bil-gateway", title: "Payment Gateway Troubleshooting", description: "Handling credit-card failures and wire transfer drops.", required: false, matchKeywords: ["gateway", "credit card", "payment fail", "wire transfer", "payment troubleshoot", "charge"] }
  ],
  "API Documentation": [
    { id: "api-auth", title: "Authentication Guidelines", description: "Bearer token protocols and rotation checklists.", required: true, matchKeywords: ["authentication", "secret", "token", "authorize", "bearer"] },
    { id: "api-throttling", title: "Rate Throttling SOP", description: "Handling 429 response rate limiting thresholds.", required: true, matchKeywords: ["throttle", "rate limit", "throttling", "429"] },
    { id: "api-webhooks", title: "Webhook Configurations Guide", description: "Parsing real-time inbound event webhook payloads.", required: false, matchKeywords: ["webhook", "payload", "event webhook", "callback"] },
    { id: "api-playground", title: "API Playground Basics", description: "Using sovereign gateway API sandbox tools.", required: false, matchKeywords: ["playground", "sandbox", "api client", "test api"] }
  ],
  "Integrations": [
    { id: "int-slack", title: "Slack Webhooks Setup", description: "Triggering slack updates on high-priority ticket events.", required: true, matchKeywords: ["slack", "slash command", "slack integration"] },
    { id: "int-teams", title: "Microsoft Teams Integration Guide", description: "Embedding Adaptive Cards in corporate Teams channels.", required: true, matchKeywords: ["teams", "microsoft teams", "adaptive card", "msteams"] },
    { id: "int-personio", title: "Personio Sync SOP", description: "Synchronizing HR workforce attendance logs securely.", required: false, matchKeywords: ["personio", "attendance", "hr sync", "sync-attendance"] },
    { id: "int-sso", title: "Identity Provider SSO Guide", description: "SAML and Entra ID SSO integration variables.", required: false, matchKeywords: ["sso", "saml", "sso identity", "entra id", "active directory"] }
  ],
  "Troubleshooting": [
    { id: "tr-vpn", title: "VPN DNS Leak Troubleshooting Guidelines", description: "DNS resolver adjustments for remote personnel.", required: true, matchKeywords: ["vpn", "dns", "tunnel fix", "network", "routing leak"] },
    { id: "tr-mfa", title: "MFA Token Reset Playbook", description: "Dealing with authentication clock-drifts.", required: true, matchKeywords: ["mfa", "desynchronization", "desync", "auth token"] },
    { id: "tr-password", title: "Password & Credential Recovery", description: "Account lockouts recovery playbooks.", required: false, matchKeywords: ["password", "credential", "reset", "forgot", "lockout", "recovery"] },
    { id: "tr-ssh", title: "SSH Secure Keys Errors", description: "Access troubles resolving public/private key pairs.", required: false, matchKeywords: ["ssh", "secure keys", "public key", "private key"] }
  ],
  "Internal SOPs": [
    { id: "sop-soc2", title: "SOC2 Daily Compliance Checklists", description: "Ensuring regulatory compliance audits track records.", required: true, matchKeywords: ["soc2", "compliance", "regulatory", "audit"] },
    { id: "sop-logging", title: "Production Logging Sanitization SOP", description: "Shredding credential slips from server trace files.", required: true, matchKeywords: ["sanitization", "log cleanup", "shredding", "telemetry erasure", "scrub", "sanitation"] },
    { id: "sop-hotfix", title: "Hotfix Deployment Sign-off Loop", description: "Step-by-step gates required before deploying patch bundles.", required: false, matchKeywords: ["hotfix", "deployment", "sign-off", "release loop"] },
    { id: "sop-vault", title: "Secret Vault Access Policy", description: "Credential limits and approval workflows.", required: false, matchKeywords: ["vault", "secret", "access policy", "vault access"] }
  ]
};

// Seed articles defined inline to guarantee coverage matches seeds loaded on the front-end
const SEED_ARTICLES = [
  { id: "seed-1", title: "Getting Started with GeistDesk", category: "Getting Started", subCategory: "Workspace Setup", content: "General Interface Overview...", tags: ["onboarding", "setup", "basics"] },
  { id: "seed-2", title: "Inviting and Managing Team Members", category: "Getting Started", subCategory: "User Provisioning", content: "User Onboarding Guide...", tags: ["team", "rbac", "permissions"] },
  { id: "seed-3", title: "Billing Plans and Invoices FAQ", category: "Billing", subCategory: "Invoicing Methods", content: "Common Billing Structure...", tags: ["invoice", "pricing", "plans"] },
  { id: "seed-4", title: "API Authentication & Secret Management Guide", category: "API Documentation", subCategory: "Authentication", content: "Bearer Token Authorization...", tags: ["api", "auth", "token", "developer"] },
  { id: "seed-5", title: "Slack and MS Teams Live Webhook Integration", category: "Integrations", subCategory: "Slack Integrations", content: "Webhook Integration...", tags: ["slack", "teams", "webhooks"] },
  { id: "seed-6", title: "Enterprise VPN and DNS Routing Debug Protocols", category: "Troubleshooting", subCategory: "VPN Configuration Issues", content: "DNS Routing Leak Mitigations...", tags: ["vpn", "dns", "network", "debug"] },
  { id: "seed-7", title: "SOC2 Compliance and Server Sanitization Guidelines", category: "Internal SOPs", subCategory: "SOC2 Incident Playbooks", content: "Sanitization of logs...", tags: ["soc2", "sop", "compliance", "security"] },
  { id: "seed-8", title: "MFA Token De-synchronization Playbook", category: "Troubleshooting", subCategory: "MFA Token De-synchronization", content: "MFA Desynchronization...", tags: ["mfa", "auth", "security", "troubleshoot"] }
];

export async function calculateCoverage(): Promise<CategoryCoverage[]> {
  // 1. Load custom articles of the knowledge base from database
  const dbArticles = await getDocsDirect("kb_articles", []);
  
  // Merge seed articles with db articles
  const allArticles = [...SEED_ARTICLES];
  for (const dbArt of dbArticles) {
    if (!allArticles.some(art => art.id === dbArt.id || art.title.toLowerCase() === dbArt.title.toLowerCase())) {
      allArticles.push({
        id: dbArt.id,
        title: dbArt.title,
        category: dbArt.category || "Getting Started",
        subCategory: dbArt.subCategory || "General Node",
        content: dbArt.content || "",
        tags: dbArt.tags || []
      });
    }
  }

  // Determine dynamic categories list (default 6 + any other custom ones found)
  const categoryNames = new Set(Object.keys(DEFAULT_EXPECTED_TOPICS));
  for (const art of allArticles) {
    if (art.category) {
      categoryNames.add(art.category);
    }
  }

  const coverages: CategoryCoverage[] = [];

  for (const catName of categoryNames) {
    // Get expected topics for this category
    const defaultTopics = DEFAULT_EXPECTED_TOPICS[catName] || [
      { id: `${catName.toLowerCase().replace(/\s+/g, '-')}-general`, title: "Setup Guide", description: "General Setup Guide for Category", required: true, matchKeywords: ["setup", "guide", "onboarding"] },
      { id: `${catName.toLowerCase().replace(/\s+/g, '-')}-troubleshoot`, title: "Troubleshooting Guide", description: "Troubleshooting and issue remediation procedures for Category", required: true, matchKeywords: ["troubleshoot", "debug", "error", "leak"] },
      { id: `${catName.toLowerCase().replace(/\s+/g, '-')}-advanced`, title: "Advanced Settings SOP", description: "Standard operating procedures for advanced setup in Category", required: false, matchKeywords: ["advanced", "sop", "policy", "security"] }
    ];

    const categoryArticles = allArticles.filter(art => art.category === catName);

    const expectedTopics: ExpectedTopic[] = defaultTopics.map(topic => {
      // Look for a matching article in this category
      let matchedArticle: any = null;
      
      for (const art of categoryArticles) {
        const titleLower = art.title.toLowerCase();
        const contentLower = (art.content || "").toLowerCase();
        const tagsLower = (art.tags || []).map((t: string) => t.toLowerCase());

        // Smart check: keyword matching on title, content, or tags
        const matchesKeyword = topic.matchKeywords.some(keyword => {
          return titleLower.includes(keyword) || 
                 contentLower.includes(keyword) || 
                 tagsLower.includes(keyword);
        });

        if (matchesKeyword) {
          matchedArticle = art;
          break;
        }
      }

      return {
        ...topic,
        matched: !!matchedArticle,
        matchedArticleId: matchedArticle ? matchedArticle.id : null
      };
    });

    const existingArticles = categoryArticles;
    const missingArticles = expectedTopics.filter(t => !t.matched);
    
    const matchedCount = expectedTopics.filter(t => t.matched).length;
    const totalCount = expectedTopics.length;
    const coveragePercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 100;

    let documentationHealth: 'Excellent' | 'Good' | 'Critical' = 'Critical';
    if (coveragePercentage >= 80) documentationHealth = 'Excellent';
    else if (coveragePercentage >= 50) documentationHealth = 'Good';

    coverages.push({
      id: catName.replace(/\s+/g, '_').toLowerCase(),
      categoryName: catName,
      expectedTopics,
      existingArticles,
      missingArticles,
      coveragePercentage,
      documentationHealth,
      lastCalculated: new Date().toISOString()
    });
  }

  // Set to database cache collection `kb_coverage`
  for (const cov of coverages) {
    await setDocDirect("kb_coverage", cov.id, cov);
  }

  return coverages;
}

export async function getDashboardData(apiKey?: string): Promise<CoverageDashboard> {
  // Query KB coverages from cache (calculate first if empty)
  let coverages = await getDocsDirect("kb_coverage", []);
  if (coverages.length === 0) {
    coverages = await calculateCoverage();
  }

  // overall stats
  const totalPercentage = coverages.reduce((sum, cov) => sum + cov.coveragePercentage, 0);
  const overallCoverage = coverages.length > 0 ? Math.round(totalPercentage / coverages.length) : 100;

  let health: 'Excellent' | 'Good' | 'Critical' = 'Critical';
  if (overallCoverage >= 80) health = 'Excellent';
  else if (overallCoverage >= 50) health = 'Good';

  // Gather total articles and missing
  const totalArticles = coverages.reduce((sum, cov) => sum + cov.existingArticles.length, 0);
  const totalMissing = coverages.reduce((sum, cov) => sum + cov.missingArticles.length, 0);

  // Critical gaps mapping (any required expectedTopic that is missing)
  const criticalGaps: { topic: string; category: string; priority: 'High' | 'Medium'; reason: string }[] = [];
  const categorySummaries: any[] = [];

  for (const cov of coverages) {
    categorySummaries.push({
      categoryName: cov.categoryName,
      coverage: cov.coveragePercentage,
      health: cov.documentationHealth,
      existingCount: cov.existingArticles.length,
      missingCount: cov.missingArticles.length
    });

    for (const missing of cov.missingArticles) {
      if (missing.required) {
        criticalGaps.push({
          topic: missing.title,
          category: cov.categoryName,
          priority: 'High',
          reason: `Required base operational documentation missing. Critical bottleneck block for ${cov.categoryName} workflows.`
        });
      }
    }
  }

  // Load ticket history to feed into AI suggester
  const tickets = await getDocsDirect("tickets", []);

  // AI Suggestions Generation (fallback + Google Gemini if key fits)
  let aiSuggestions: { title: string; category: string; reason: string; priority: 'High' | 'Medium'; matchedTicketId?: string }[] = [];

  // Rules-based fallback suggestions mapping ticket complaints directly!
  const hasLoginTicket = tickets.some(t => {
    const subj = (t.subject || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    return subj.includes("login") || desc.includes("login") || subj.includes("credential") || subj.includes("password");
  });

  const hasLatencyTicket = tickets.some(t => {
    const subj = (t.subject || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    return subj.includes("delay") || desc.includes("latency") || subj.includes("performance") || subj.includes("slow");
  });

  const hasExportTicket = tickets.some(t => {
    const subj = (t.subject || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    return subj.includes("export") || desc.includes("pdf") || subj.includes("report");
  });

  if (hasLoginTicket) {
    const loginTicket = tickets.find(t => (t.subject || "").toLowerCase().includes("login") || (t.description || "").toLowerCase().includes("login"));
    aiSuggestions.push({
      title: "Workspace Login Credential Recovery SOP",
      category: "Troubleshooting",
      reason: `Suggested because customers recently lodged high-severity support tickets regarding login reset buffers ("${loginTicket?.subject || 'Login issues'}").`,
      priority: "High",
      matchedTicketId: loginTicket?.id
    });
  }

  if (hasLatencyTicket) {
    const perfTicket = tickets.find(t => (t.subject || "").toLowerCase().includes("delay") || (t.description || "").toLowerCase().includes("delay"));
    aiSuggestions.push({
      title: "Cognitive Latency & Client Database Throttling Remediation Guide",
      category: "Troubleshooting",
      reason: `Triggered by Urgent tickets tracking latency delays inside production nodes ("${perfTicket?.subject || 'Latency in production'}").`,
      priority: "High",
      matchedTicketId: perfTicket?.id
    });
  }

  if (hasExportTicket) {
    const repTicket = tickets.find(t => (t.subject || "").toLowerCase().includes("export") || (t.description || "").toLowerCase().includes("export"));
    aiSuggestions.push({
      title: "Sovereign PDF Weekly Report Export Configurations Guide",
      category: "API Documentation",
      reason: `Identified by feature-request tickets stating customers need standard PDF report export templates ("${repTicket?.subject || 'Report configurations'}").`,
      priority: "Medium",
      matchedTicketId: repTicket?.id
    });
  }

  // Populate basic fallback suggestions to ensure something is always shown
  if (aiSuggestions.length === 0) {
    aiSuggestions.push({
      title: "Active Directory SSO SAML Handshake Guide",
      category: "Integrations",
      reason: "Detected as missing core security integration documentation in your workspace setup.",
      priority: "High"
    });
    aiSuggestions.push({
      title: "Disaster Recovery Procedures drill playbook",
      category: "Getting Started",
      reason: "High-priority gap mapping. Disaster recovery guidelines are recommended for standard SOC2 auditing compliance levels.",
      priority: "Medium"
    });
  }

  // If Gemini API Key is available, enrich suggestions!
  if (apiKey || process.env.GEMINI_API_KEY) {
    try {
      const activeApiKey = apiKey || process.env.GEMINI_API_KEY || "";
      const aiClient = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const ticketDetails = tickets.slice(0, 15).map(t => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        tags: t.tags
      }));

      const existingArticleSummaries = coverages.map(cov => ({
        category: cov.categoryName,
        articles: cov.existingArticles.map(a => a.title)
      }));

      const missingExpected = coverages.map(cov => ({
        category: cov.categoryName,
        missing: cov.missingArticles.map(m => m.title)
      }));

      const sysInstruction = `You are an expert technical writer and ticket triage supervisor. 
Check support ticket history and compare them against already existing and missing documentation categories in the KB structure.
Output a highly professional JSON list of 3 suggested articles to create.
For each item return format with exactly: "title" (specific article title to write), "category" (must match one of the available categories: "Getting Started", "Billing", "API Documentation", "Integrations", "Troubleshooting", "Internal SOPs"), "reason" (detailed literal summary explaining which specific ticket or operational gap triggered this), "priority" ("High" or "Medium"), and "matchedTicketId" (which ticket ID caused this).
No markdown surrounding, output only valid JSON.`;

      const prompt = `EXSTING ARTICLES BY CATEGORY:
${JSON.stringify(existingArticleSummaries, null, 2)}

MISSING STANDARD PRESETS:
${JSON.stringify(missingExpected, null, 2)}

RECENT TICKET HISTORY COMPLAINTS:
${JSON.stringify(ticketDetails, null, 2)}

Generate 3 rich missing article suggestions based on this. Provide only valid JSON schema list in brackets.`;

      const geminiResponse = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json"
        }
      });

      const textOutput = geminiResponse.text?.trim() || "";
      const cleaned = textOutput.substring(textOutput.indexOf("["), textOutput.lastIndexOf("]") + 1);
      
      if (cleaned) {
        const geminiSuggestions = JSON.parse(cleaned);
        if (Array.isArray(geminiSuggestions) && geminiSuggestions.length > 0) {
          aiSuggestions = geminiSuggestions;
        }
      }
    } catch (e) {
      console.warn("[Coverage Engine AI Analysis fallback invoked due to error]:", e);
    }
  }

  return {
    overallCoverage,
    totalArticles,
    totalMissing,
    health,
    criticalGaps: criticalGaps.slice(0, 5),
    categorySummaries,
    aiSuggestions
  };
}
