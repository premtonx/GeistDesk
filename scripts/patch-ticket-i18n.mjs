import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const patch = {
  statusLabels: {
    open: { en: 'Open', de: 'Offen' },
    pending: { en: 'Pending', de: 'Wartend' },
    resolved: { en: 'Resolved', de: 'Gelöst' },
    closed: { en: 'Closed', de: 'Geschlossen' },
    qs: { en: 'Quality assurance', de: 'Qualitätssicherung' },
    merged: { en: 'Merged', de: 'Zusammengeführt' },
    trash: { en: 'Deleted', de: 'Gelöscht' },
  },
  typeLabels: {
    incident: { en: 'Incident', de: 'Vorfall (Incident)' },
    question: { en: 'Question', de: 'Frage (Question)' },
    problem: { en: 'Problem', de: 'Problem' },
    feature_request: { en: 'Feature request', de: 'Feature-Anfrage' },
  },
  aiSummaryCardExtra: {
    analyzing: { en: 'Analyzing...', de: 'Analysiere...' },
    fullAnalysis: { en: 'Full Analysis', de: 'Vollständige Analyse' },
    toggleSummary: { en: 'Toggle summary', de: 'Zusammenfassung umschalten' },
    defaultRootCause: {
      en: 'Configuration parameter mismatch inside client database profile or stripe status.',
      de: 'Konfigurationsparameter stimmen nicht mit dem Kunden-Datenbankprofil oder Stripe-Status überein.',
    },
    p1Immediate: { en: 'P1 — HANDLE IMMEDIATELY', de: 'P1 — SOFORT BEHANDELN' },
    p2High: { en: 'P2 — HIGH PRIORITY', de: 'P2 — HOHE PRIORITÄT' },
  },
  detailExtra: {
    slaDuePending: { en: 'Due in —', de: 'Fällig in —' },
    slaDueIn: { en: 'Due in {{hours}}h {{mins}}m', de: 'Fällig in {{hours}} Std. {{mins}} Min.' },
  },
  conversation: {
    reply: { en: 'Reply', de: 'Antworten' },
    quote: { en: 'Quote', de: 'Zitieren' },
    copy: { en: 'Copy', de: 'Kopieren' },
    messageCopied: { en: 'Message copied!', de: 'Nachricht kopiert!' },
  },
  relatedTab: {
    activeLinkings: { en: 'Active neural linkings', de: 'Aktive neuronale Verknüpfungen' },
    scanning: { en: 'Scanning...', de: 'Scanne...' },
    scanContextLinks: { en: 'Scan context links', de: 'Kontext-Links scannen' },
    masterTicketController: { en: 'Master ticket controller', de: 'Master-Ticket-Steuerung' },
    masterTicketDesc: {
      en: 'This support incident has been upgraded to a master ticket coordinating {{count}} linked sub-tickets.',
      de: 'Dieser Supportfall wurde zu einem Master-Ticket hochgestuft und koordiniert {{count}} verknüpfte Unter-Tickets.',
    },
    ticketReference: { en: 'Ticket reference: #{{id}}', de: 'Ticket-Referenz: #{{id}}' },
    noLinkages: {
      en: 'No active neural ticket linkages established for this session.',
      de: 'Für diese Sitzung wurden keine aktiven neuronalen Ticket-Verknüpfungen erstellt.',
    },
    linkedToParent: { en: 'Linked to parent master', de: 'Mit übergeordnetem Master verknüpft' },
    parent: { en: 'Parent: #{{id}}', de: 'Übergeordnet: #{{id}}' },
    linkManually: { en: 'Link and unify manually', de: 'Manuell verknüpfen und vereinheitlichen' },
    linkPlaceholder: {
      en: 'Enter manual ticket ID (e.g. #IT-0041 or uuid)...',
      de: 'Ticket-ID manuell eingeben (z. B. #IT-0041 oder UUID)...',
    },
    aiRecommendations: { en: 'AI link recommendations', de: 'KI-Verknüpfungsempfehlungen' },
    matchPercent: { en: '{{percent}}% match', de: '{{percent}} % Übereinstimmung' },
    confirmMatch: { en: 'Confirm match', de: 'Übereinstimmung bestätigen' },
    scanPrompt: {
      en: 'Scan context links above to trigger real-time vector matches against historical support tickets.',
      de: 'Scannen Sie oben die Kontext-Links, um Echtzeit-Vektorabgleiche mit historischen Support-Tickets auszulösen.',
    },
  },
  timelineTab: {
    title: { en: 'Chronological ticket audit timeline', de: 'Chronologisches Ticket-Audit-Zeitprotokoll' },
    subtitle: { en: 'GoBD compliance logs', de: 'GoBD-Konformitätsprotokolle' },
    ticketReceived: { en: 'Ticket received', de: 'Ticket eingegangen' },
    ticketReceivedDesc: {
      en: 'Support case launched via {{channel}} channel.',
      de: 'Supportfall über Kanal {{channel}} eröffnet.',
    },
    customerResponse: { en: 'Customer response', de: 'Kundenantwort' },
    aiResponseDrafted: { en: 'AI response drafted', de: 'KI-Antwort entworfen' },
    agentReplyDispatched: { en: 'Agent reply dispatched', de: 'Agentenantwort gesendet' },
    internalNoteRecorded: { en: 'Internal agent note recorded', de: 'Interne Agentennotiz protokolliert' },
    anonymous: { en: 'Anonymous', de: 'Anonym' },
    portal: { en: 'portal', de: 'Portal' },
  },
  sidebar: {
    title: { en: 'Dispatch desk properties', de: 'Eigenschaften Dispatch-Desk' },
    dynamicRag: { en: 'Dynamic RAG', de: 'Dynamisches RAG' },
    agentAssignment: { en: 'Agent assignment', de: 'Agenten-Zuweisung' },
    activelyAssigned: { en: 'Actively assigned', de: 'Aktiv zugewiesen' },
    unassignedBadge: { en: 'Unassigned', de: 'Nicht zugewiesen' },
    responsibleAgent: { en: 'Responsible agent', de: 'Verantwortlicher Bearbeiter' },
    clickToAssign: { en: 'Click below to assign this ticket', de: 'Klicken Sie unten, um das Ticket zuzuweisen' },
    selectDispatchAgent: { en: 'Select dispatch agent', de: 'Dispatch-Agenten auswählen' },
    dispatchCaseStatus: { en: 'Dispatch case status', de: 'Dispatch-Fallstatus' },
    slaHelpEscalation: { en: 'SLA help escalation', de: 'SLA-Hilfeeskalation' },
    aiCopilotHub: { en: 'AI Copilot SmartHub', de: 'KI-Copilot SmartHub' },
    suggestedAiStrategy: { en: 'Suggested AI strategy', de: 'Vorgeschlagene KI-Strategie' },
    aiStrategySample: {
      en: 'Confirm Microsoft Entra configuration parity. Draft a polite message to confirm the security review.',
      de: 'Microsoft Entra-Konfigurationsparität bestätigen. Einen höflichen Entwurf zur Bestätigung der Sicherheitsüberprüfung erstellen.',
    },
    oneClickAiCommands: { en: 'One-click AI commands', de: 'KI-Befehle mit einem Klick' },
    draftReply: { en: 'Draft reply', de: 'Antwort entwerfen' },
    kbExtraction: { en: 'KB extraction', de: 'KB-Extraktion' },
    verifiedKbCitations: { en: 'Verified KB citations', de: 'Verifizierte KB-Zitate' },
    sampleKbRule: { en: 'Microsoft Entra SSO parity rule', de: 'Microsoft Entra SSO Paritätsregel' },
    confidence: { en: '{{percent}}% confidence', de: '{{percent}} % Konfidenz' },
    standardProperties: { en: 'Standard properties', de: 'Standard-Eigenschaften' },
    ticketCategory: { en: 'Ticket category', de: 'Ticket-Kategorie' },
    lifecycleStatus: { en: 'Lifecycle status', de: 'Lebenszyklus-Status' },
    dynamicSentiment: { en: 'Dynamic sentiment', de: 'Dynamische Stimmung' },
    customerContext: { en: 'Customer context', de: 'Kundenkontext' },
    metadataTags: { en: 'Metadata tags', de: 'Metadaten-Tags' },
    noTagsDefined: { en: 'No manual tags defined.', de: 'Keine manuellen Tags definiert.' },
    tagPlaceholder: { en: 'Enter tag...', de: 'Tag eingeben...' },
    aiTagSuggestions: { en: 'AI tag suggestions', de: 'KI-Label-Vorschläge' },
    linkedTickets: { en: 'Linked tickets ({{count}})', de: 'Verbundene Tickets ({{count}})' },
    noActiveLinks: { en: 'No active linkages.', de: 'Keine aktiven Verknüpfungen.' },
    incReference: { en: 'Inc: #{{id}}', de: 'Inc: #{{id}}' },
  },
  emailComposer: {
    from: { en: 'From:', de: 'Von:' },
    to: { en: 'To:', de: 'An:' },
    subject: { en: 'Subject:', de: 'Betreff:' },
    guardrails: { en: '(Corporate guardrails enabled)', de: '(Unternehmensrichtlinien aktiv)' },
    aiSuggestedStrategy: { en: 'AI suggested strategy:', de: 'KI-vorgeschlagene Strategie:' },
    suggestionPreview: {
      en: 'Hi there, I have investigated this issue...',
      de: 'Hallo, ich habe dieses Problem untersucht...',
    },
    applyOpening: { en: 'Apply opening', de: 'Einleitung übernehmen' },
    suggestionApplied: { en: 'AI strategic opening applied to composer.', de: 'KI-Strategie-Einleitung in den Editor übernommen.' },
    placeholder: {
      en: 'Type your professional response here... To activate AI drafting assistance, use the AI actions toolbar below.',
      de: 'Geben Sie hier Ihre professionelle Antwort ein... Für KI-Unterstützung nutzen Sie die KI-Aktionen in der Symbolleiste unten.',
    },
    legalWarningTitle: { en: 'Safeguard violation warning', de: 'Safeguard-Verstoß-Warnung' },
    legalWarningDefault: {
      en: 'The response draft contains unauthorized language or unverified contractual commitments.',
      de: 'Der Antwortentwurf enthält nicht autorisierte Formulierungen oder ungeprüfte vertragliche Zusagen.',
    },
    aiAssistDraft: { en: 'AI assist draft', de: 'KI-Entwurf' },
    tonePolish: { en: 'Tone polish', de: 'Ton anpassen' },
    translate: { en: 'Translate', de: 'Übersetzen' },
    threadDigest: { en: 'Thread digest', de: 'Thread-Zusammenfassung' },
    discard: { en: 'Discard', de: 'Verwerfen' },
    auditing: { en: 'Auditing...', de: 'Prüfe...' },
    sendReply: { en: 'Send reply', de: 'Antwort senden' },
  },
  aiInsightsTab: {
    emptyCitations: {
      en: 'AI citations are currently empty. Click "Draft with AI" or trigger a prompt to query the knowledge database.',
      de: 'KI-Zitate sind derzeit leer. Klicken Sie auf „Mit KI entwerfen“ oder starten Sie eine Abfrage gegen die Wissensdatenbank.',
    },
  },
  assetsTab: {
    enterSecret: { en: 'Please enter a secret to secure.', de: 'Bitte geben Sie ein Geheimnis ein.' },
    linkCreated: { en: 'One-time security link produced.', de: 'Einmal-Sicherheitslink erstellt.' },
    secretSharedMsg: {
      en: '🔒 [Security Exchange Event] Shared a secure credential ({{type}}) with client via GeistExchange. One-time link burned upon first access: {{url}}',
      de: '🔒 [Sicherheits-Austausch] GeistExchange hat sichere Anmeldedaten ({{type}}) für den Kunden freigegeben. Der Einmal-Link verfällt sofort nach der ersten Ansicht: {{url}}',
    },
    secretAppended: {
      en: 'Shared secret delivery link successfully appended on ticket conversation thread!',
      de: 'Sicherheits-Link für das Geheimnis wurde erfolgreich an den Konversationsverlauf des Tickets angehängt!',
    },
    linkFailed: { en: 'Failed to generate secure link.', de: 'Fehler beim Generieren des sicheren Links.' },
    logRequest: { en: 'Diagnostic log request', de: 'Diagnoseprotokoll-Anforderung' },
    logRequestDesc: {
      en: 'Please transmit router diagnostic error log archives safely.',
      de: 'Bitte übertragen Sie Router-Fehlerprotokollarchive sicher.',
    },
    dumpRequest: { en: 'SQL engine pool dump', de: 'Datenbank-Abbild-Anforderung' },
    dumpRequestDesc: {
      en: 'Submit database schemas and logs securely.',
      de: 'Übermitteln Sie Datenbankschemata und -protokolle sicher.',
    },
    screenshotRequest: { en: 'Operational screenshots', de: 'Betriebliche Screenshots' },
    screenshotRequestDesc: {
      en: 'Provide screenshots showing the error modal logs.',
      de: 'Stellen Sie Screenshots bereit, die die Fehlerprotokolle zeigen.',
    },
    uploadRequestedMsg: {
      en: '📡 [Security Exchange Event] Requested secure diagnostics cargo ({{name}}) from client. Upload dropzone link: {{url}}',
      de: '📡 [Sicherheits-Austausch] Sichere Diagnosedaten ({{name}}) vom Client über GeistExchange angefordert. Uploadlink: {{url}}',
    },
    uploadGenerated: {
      en: 'Secure upload request generated and appended to ticket conversation! URL: {{url}}',
      de: 'Sichere Upload-Anforderung generiert und an den Konversationsverlauf angehängt! URL: {{url}}',
    },
    uploadFailed: {
      en: 'Could not construct secure upload dropzone.',
      de: 'Sichere Upload-Anforderung konnte nicht erstellt werden.',
    },
    copiedClipboard: { en: 'Copied to clipboard', de: 'In die Zwischenablage kopiert.' },
    softwareSubscription: { en: 'Software subscription', de: 'Software-Abonnement' },
    active: { en: 'Active', de: 'Aktiv' },
    expiryDec2026: { en: 'Dec 31, 2026', de: '31. Dez 2026' },
    sandboxPool: { en: 'Central sandbox tenant pool', de: 'Zentraler Sandbox-Tenant-Pool' },
    cloudEnvironment: { en: 'Cloud environment', de: 'Cloud-Umgebung' },
    onDemand: { en: 'On demand', de: 'Auf Anfrage' },
    mobileLicense: { en: 'GeistDesk mobile license', de: 'GeistDesk Mobile-Lizenz' },
    proCore: { en: 'GeistDeskTech Pro Core', de: 'GeistDeskTech Pro Core' },
    secureActions: { en: 'GeistExchange secure actions', de: 'GeistExchange Sicherheitsaktionen' },
    licensedAssets: { en: 'Licensed assets', de: 'Lizenzierte Assets' },
    sendSecretTitle: { en: 'Send secure secret to client', de: 'Sicheres Geheimnis an Client senden' },
    sendSecretDesc: {
      en: 'Generate a post-quantum link that burns upon read. Delivery link is appended on the ticket conversation stream!',
      de: 'Generieren Sie einen Link, der nach einmaligem Lesen verfällt. Der Erstellungs-Link wird an den Konversationsverlauf angehängt!',
    },
    secretType: { en: 'Secret type', de: 'Art des Geheimnisses' },
    durationPolicies: { en: 'Duration policies', de: 'Ablaufrichtlinien' },
    burnUponAccess: { en: 'Burn upon access', de: 'Nach Zugriff löschen' },
    secretValues: { en: 'Secret values', de: 'Geheimniswerte' },
    secretPlaceholder: {
      en: 'Enter database keys, passcodes, internal links...',
      de: 'Geben Sie Datenbankschlüssel, Passwörter, interne Links ein...',
    },
    copied: { en: 'Copied', de: 'Kopiert' },
    copy: { en: 'Copy', de: 'Kopieren' },
    transmitCredential: { en: 'Transmit shielded credential', de: 'Sichere Anmeldedaten übertragen' },
    secureUploads: { en: 'Secure customer uploads request', de: 'Sichere Upload-Anforderungen' },
    secureUploadsDesc: {
      en: 'Request files, server dumps or screen visuals directly. Delivery dropzone is uploaded on ticket timeline automatically.',
      de: 'Fordern Sie Dateien, Backups oder Screenshots an. Der Upload-Link wird automatisch an den Konversationsverlauf angehängt.',
    },
    fastPresets: { en: 'Fast presets', de: 'Schnellvorlagen' },
    requestLogs: { en: 'Request logs', de: 'Logs anfordern' },
    collectZipLog: { en: 'Collect ZIP, LOG', de: 'Sammle ZIP, LOG' },
    dbBackups: { en: 'DB backups', de: 'DB-Backups' },
    collectSql: { en: 'Collect SQL dumps', de: 'Sammle SQL-Dumps' },
    screenshots: { en: 'Screenshots', de: 'Screenshots' },
    collectPng: { en: 'Collect PNG, JPG', de: 'Sammle PNG, JPG' },
    quantumSecure: { en: 'Quantum secure dropping:', de: 'Quantensichere Übertragungsbox:' },
    icapScanDesc: {
      en: 'The upload engine forces deep ICAP malware scanning on ingress before files land in sovereign storage.',
      de: 'Die Upload-Engine erzwingt eine umfassende ICAP-Malwareprüfung eingehender Dateien, bevor diese im souveränen Speicher abgelegt werden.',
    },
    activeSecurityLinks: { en: 'Active security links on this ticket', de: 'Aktive Sicherheitslinks für dieses Ticket' },
    linksTracked: { en: 'links tracked', de: 'Links nachverfolgt' },
    cargoTarget: { en: 'Asset/cargo target', de: 'Asset-/Daten-Ziel' },
    type: { en: 'Type', de: 'Typ' },
    status: { en: 'Status', de: 'Status' },
    expiryRules: { en: 'Expiry rules', de: 'Ablaufregeln' },
    interactive: { en: 'Interactive', de: 'Interaktiv' },
    dropzoneRequest: { en: 'Cargo dropzone request', de: 'Daten-Dropzone-Anforderung' },
    credentialsRecord: { en: 'Credentials record: {{type}}', de: 'Zugangsdaten-Eintrag: {{type}}' },
    burned: { en: 'Burned', de: 'Verfallen' },
    selfDestruct: { en: 'Self-destruct upon single view', de: 'Selbstzerstörung nach erster Ansicht' },
    hoursLifecycle: { en: '48 hours lifecycle', de: '48 Stunden Lebensdauer' },
    linkShredded: { en: 'Link shredded.', de: 'Sicherheits-Link unwiderruflich gelöscht.' },
    noActiveItems: {
      en: 'No active secrets or dropzone files mapped to TKT-{{id}} yet.',
      de: 'Noch keine aktiven Geheimnisse oder Upload-Anforderungen für TKT-{{id}} hinterlegt.',
    },
    serialKey: { en: 'Serial / license key', de: 'Seriennummer / Key' },
    expiryRenewal: { en: 'Expiry / renewal', de: 'Ablauf / Erneuerung' },
    verifiedSubscription: { en: 'Verified client subscription', de: 'Verifiziertes Kunden-Abonnement' },
    secretTypes: {
      password: { en: 'Password', de: 'Passwort' },
      api_key: { en: 'API key', de: 'API-Schlüssel' },
      ssh_key: { en: 'SSH key', de: 'SSH-Schlüssel' },
      vpn: { en: 'VPN file', de: 'VPN-Datei' },
      note: { en: 'Secure note', de: 'Sichere Notiz' },
    },
  },
};

function buildSection(lang) {
  const out = {};
  for (const [section, keys] of Object.entries(patch)) {
    if (section === 'aiSummaryCardExtra') {
      out.aiSummaryCard = out.aiSummaryCard || {};
      for (const [k, v] of Object.entries(keys)) {
        out.aiSummaryCard[k] = v[lang];
      }
      continue;
    }
    if (section === 'detailExtra') {
      out.detail = out.detail || {};
      for (const [k, v] of Object.entries(keys)) {
        out.detail[k] = v[lang];
      }
      continue;
    }
    out[section] = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v.en !== undefined) {
        out[section][k] = v[lang];
      } else {
        out[section][k] = {};
        for (const [sk, sv] of Object.entries(v)) {
          out[section][k][sk] = sv[lang];
        }
      }
    }
  }
  return out;
}

for (const lang of ['en', 'de']) {
  const file = path.join(root, 'src/locales', lang, 'common.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const section = buildSection(lang);
  data.tickets = { ...data.tickets, ...section };
  // merge aiSummaryCard and detail deeply
  if (section.aiSummaryCard) {
    data.tickets.aiSummaryCard = { ...data.tickets.aiSummaryCard, ...section.aiSummaryCard };
  }
  if (section.detail) {
    data.tickets.detail = { ...data.tickets.detail, ...section.detail };
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Patched ${lang}/common.json`);
}
