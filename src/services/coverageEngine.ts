import { GoogleGenAI } from "@google/genai";
import { getDocsDirect, setDocDirect, deleteDocDirect } from '../lib/postgres-backend';

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
  overallPercentage: number;
  totalArticles: number;
  totalExpected: number;
  totalExistingMatched: number;
  totalMissing: number;
  health: 'Excellent' | 'Good' | 'Critical' | 'Empty';
  healthStatus: 'Excellent' | 'Good' | 'Critical' | 'Empty';
  criticalGaps: { topic: string; category: string; priority: 'High' | 'Medium'; reason: string }[];
  categorySummaries: { categoryName: string; coverage: number; health: string; existingCount: number; missingCount: number }[];
  categories: CategoryCoverage[];
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

type CoverageArticle = {
  id: string;
  title: string;
  category: string;
  subCategory: string;
  content: string;
  tags: string[];
};

function mapDbArticle(dbArt: { id: string; title?: string; category?: string; subCategory?: string; content?: string; tags?: string[] }): CoverageArticle {
  return {
    id: dbArt.id,
    title: dbArt.title || "",
    category: dbArt.category || "",
    subCategory: dbArt.subCategory || "",
    content: dbArt.content || "",
    tags: Array.isArray(dbArt.tags) ? dbArt.tags : [],
  };
}

function coverageContainsSeedArticles(coverages: Array<{ existingArticles?: Array<{ id?: string }> }>): boolean {
  return coverages.some((cov) =>
    (cov.existingArticles || []).some((art) => String(art?.id || "").startsWith("seed-")),
  );
}

async function replaceCoverageCache(coverages: CategoryCoverage[]): Promise<void> {
  const previous = await getDocsDirect("kb_coverage", []);
  const nextIds = new Set(coverages.map((cov) => cov.id));
  for (const prev of previous) {
    if (!nextIds.has(prev.id)) {
      await deleteDocDirect("kb_coverage", prev.id);
    }
  }
  for (const cov of coverages) {
    await setDocDirect("kb_coverage", cov.id, cov);
  }
}

function emptyDashboard(): CoverageDashboard {
  return {
    overallCoverage: 0,
    overallPercentage: 0,
    totalArticles: 0,
    totalExpected: 0,
    totalExistingMatched: 0,
    totalMissing: 0,
    health: "Empty",
    healthStatus: "Empty",
    criticalGaps: [],
    categorySummaries: [],
    categories: [],
    aiSuggestions: [],
  };
}

export async function calculateCoverage(): Promise<CategoryCoverage[]> {
  const dbArticles = await getDocsDirect("kb_articles", []);
  const dbCategories = await getDocsDirect("kb_categories", []);
  const allArticles = dbArticles.map(mapDbArticle);

  type CategoryRef = { id: string; name: string };
  const categoryRefs: CategoryRef[] = [];
  const seen = new Set<string>();

  for (const cat of dbCategories) {
    const name = String(cat.name || cat.id || "").trim();
    const id = String(cat.id || name);
    if (!id || seen.has(id) || seen.has(name)) continue;
    seen.add(id);
    if (name) seen.add(name);
    categoryRefs.push({ id, name: name || id });
  }

  for (const art of allArticles) {
    if (!art.category || seen.has(art.category)) continue;
    seen.add(art.category);
    categoryRefs.push({ id: art.category, name: art.category });
  }

  if (categoryRefs.length === 0) {
    await replaceCoverageCache([]);
    return [];
  }

  const coverages: CategoryCoverage[] = [];

  for (const cat of categoryRefs) {
    const templateTopics = DEFAULT_EXPECTED_TOPICS[cat.name] || [];
    const categoryArticles = allArticles.filter(
      (art) => art.category === cat.id || art.category === cat.name,
    );

    const expectedTopics: ExpectedTopic[] = templateTopics.map((topic) => {
      let matchedArticle: CoverageArticle | null = null;
      for (const art of categoryArticles) {
        const titleLower = art.title.toLowerCase();
        const contentLower = (art.content || "").toLowerCase();
        const tagsLower = (art.tags || []).map((t: string) => t.toLowerCase());
        const matchesKeyword = topic.matchKeywords.some((keyword) => {
          return titleLower.includes(keyword) || contentLower.includes(keyword) || tagsLower.includes(keyword);
        });
        if (matchesKeyword) {
          matchedArticle = art;
          break;
        }
      }
      return {
        ...topic,
        matched: !!matchedArticle,
        matchedArticleId: matchedArticle ? matchedArticle.id : null,
      };
    });

    const existingArticles = categoryArticles;
    const missingArticles = categoryArticles.length === 0 ? [] : expectedTopics.filter((t) => !t.matched);
    const matchedCount = expectedTopics.filter((t) => t.matched).length;
    const totalCount = expectedTopics.length;
    const coveragePercentage =
      categoryArticles.length === 0
        ? 0
        : totalCount > 0
          ? Math.round((matchedCount / totalCount) * 100)
          : 100;

    let documentationHealth: "Excellent" | "Good" | "Critical" = "Critical";
    if (categoryArticles.length === 0) documentationHealth = "Critical";
    else if (coveragePercentage >= 80) documentationHealth = "Excellent";
    else if (coveragePercentage >= 50) documentationHealth = "Good";

    coverages.push({
      id: cat.id.replace(/\s+/g, "-").toLowerCase(),
      categoryName: cat.name,
      expectedTopics,
      existingArticles,
      missingArticles,
      coveragePercentage,
      documentationHealth,
      lastCalculated: new Date().toISOString(),
    });
  }

  await replaceCoverageCache(coverages);
  return coverages;
}

export async function getDashboardData(apiKey?: string): Promise<CoverageDashboard> {
  const dbArticles = await getDocsDirect("kb_articles", []);
  let coverages = await getDocsDirect("kb_coverage", []);
  if (coverages.length === 0 || coverageContainsSeedArticles(coverages) || dbArticles.length === 0) {
    coverages = await calculateCoverage();
  }

  if (coverages.length === 0 && dbArticles.length === 0) {
    return emptyDashboard();
  }

  const totalPercentage = coverages.reduce((sum, cov) => sum + (Number(cov.coveragePercentage) || 0), 0);
  const overallCoverage = coverages.length > 0 ? Math.round(totalPercentage / coverages.length) : 0;

  let health: 'Excellent' | 'Good' | 'Critical' | 'Empty' = 'Empty';
  if (coverages.length === 0) health = 'Empty';
  else if (overallCoverage >= 80) health = 'Excellent';
  else if (overallCoverage >= 50) health = 'Good';
  else health = 'Critical';

  const totalArticles = coverages.reduce((sum, cov) => sum + (cov.existingArticles?.length || 0), 0);
  const totalExpected = coverages.reduce((sum, cov) => sum + (cov.expectedTopics?.length || 0), 0);
  const totalExistingMatched = coverages.reduce(
    (sum, cov) => sum + (cov.expectedTopics?.filter((t: ExpectedTopic) => t.matched).length || 0),
    0,
  );
  const totalMissing = coverages.reduce((sum, cov) => sum + (cov.missingArticles?.length || 0), 0);

  // Critical gaps mapping (any required expectedTopic that is missing)
  const criticalGaps: { topic: string; category: string; priority: 'High' | 'Medium'; reason: string }[] = [];
  const categorySummaries: any[] = [];

  for (const cov of coverages) {
    categorySummaries.push({
      categoryName: cov.categoryName,
      coverage: cov.coveragePercentage,
      health: cov.documentationHealth,
      existingCount: cov.existingArticles?.length || 0,
      missingCount: cov.missingArticles?.length || 0,
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

  // Empty knowledge bases must not invent recommendations from tickets or templates.
  if (totalArticles === 0) {
    return {
      overallCoverage,
      overallPercentage: overallCoverage,
      totalArticles,
      totalExpected,
      totalExistingMatched,
      totalMissing,
      health,
      healthStatus: health,
      criticalGaps: criticalGaps.slice(0, 5),
      categorySummaries,
      categories: coverages as CategoryCoverage[],
      aiSuggestions: [],
    };
  }

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
    overallPercentage: overallCoverage,
    totalArticles,
    totalExpected,
    totalExistingMatched,
    totalMissing,
    health,
    healthStatus: health,
    criticalGaps: criticalGaps.slice(0, 5),
    categorySummaries,
    categories: coverages as CategoryCoverage[],
    aiSuggestions
  };
}
