/**
 * Monitor — unified intelligence map tab
 *
 * Merges News Map (CampaignWatch) and Map Explorer into a single tab.
 * CampaignWatch already contains the full DeckGLMap + live layers + news panel.
 * The StatePanel from MapPage is surfaced via map click (already implemented
 * inside CampaignWatch's CorruptionDialog + state handler).
 */

import CampaignWatch from "./CampaignWatch.jsx";

export default function Monitor() {
  return <CampaignWatch />;
}
