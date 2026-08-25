/**
 * ==============================================================================
 * NEXUS SOVEREIGN PLATFORM - MICROSOFT TEAMS ADAPTIVE CARDS ENGINE
 * ==============================================================================
 * 
 * Programmatic visual generation utilizing Adaptive Card schema version 1.4.
 * Seamlessly interfaces with the Microsoft Teams client and Bot connectors 
 * to surface secure, interactive message payloads inside user threads.
 */

/**
 * Generates an interactive, highly polished Adaptive Card layout for Microsoft Teams.
 * 
 * @param {string} responseText - Clean Markdown content produced by the secure LLM orchestrator.
 * @param {boolean} wasScrubbed - Safe status indicating if local entity filtering was active.
 * @returns {Object} Adaptive Card response payload matching standard v1.4 guidelines.
 */
export function createAdaptiveCard(responseText, wasScrubbed) {
  // Graceful fallback for blank outputs
  const safeContent = responseText && responseText.trim() !== "" 
    ? responseText 
    : "_No text payload emitted from the sovereign validation orchestrator._";

  // Formulate warning/compliance badge details based on redaction shield alert status
  const statusMessage = wasScrubbed
    ? "⚠️ PII detected and local entity redaction active."
    : "🛡️ GeistDesk Sovereign Shield Enabled | Powered by Azure AI";

  const alertColor = wasScrubbed ? "Warning" : "Good";
  const containerStyle = wasScrubbed ? "warning" : "accent";

  console.log(`[AdaptiveCardEngine] Assembling teams card layout structure. RedactedAlertState: "${wasScrubbed}"`);

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      // Top Brand Container with modern Fluent design styling
      {
        type: "Container",
        bleed: true,
        style: "emphasis",
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "Image",
                    url: "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shield/Colored/3D/shield_3d.png",
                    size: "Small",
                    altText: "Secure Shield Indicator"
                  }
                ]
              },
              {
                type: "Column",
                width: "stretch",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "TextBlock",
                    text: "NexuSovereign™ Gate",
                    weight: "Bolder",
                    size: "Medium",
                    color: "Accent"
                  },
                  {
                    type: "TextBlock",
                    text: "Sovereign Enterprise Workspace",
                    isSubtle: true,
                    size: "Small",
                    spacing: "None"
                  }
                ]
              }
            ]
          }
        ]
      },
      // Main content block supporting rich Markdown capabilities
      {
        type: "Container",
        spacing: "Medium",
        items: [
          {
            type: "TextBlock",
            text: safeContent,
            wrap: true,
            size: "Default"
          }
        ]
      },
      // Compliance/Security Footer Banner Badge Container
      {
        type: "Container",
        spacing: "Large",
        style: containerStyle,
        bleed: true,
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "stretch",
                verticalContentAlignment: "Center",
                items: [
                  {
                    type: "TextBlock",
                    text: statusMessage,
                    weight: "Bolder",
                    size: "Small",
                    color: alertColor,
                    wrap: true
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "Access GeistDesk Secure Portal",
        url: process.env.GEISTDESK_CUSTOMER_PORTAL_URL || "https://geistdesk.sovereign.local/portal",
        style: "positive"
      }
    ]
  };
}
