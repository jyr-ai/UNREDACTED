import { useTheme } from '../../theme/index.js';

function Footer() {
  const t = useTheme();
  return (
    <div style={{ background: t.cardB, borderTop: `1px solid ${t.border}`, padding: "14px 18px", marginTop: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Roboto', sans-serif", fontSize: 8, color: t.low }}>
          © 2026 UNREDACTED — Transparency in Government
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#" style={{ fontFamily: "'Roboto', sans-serif", fontSize: 8, color: t.mid, textDecoration: "none" }}>API</a>
          <a href="#" style={{ fontFamily: "'Roboto', sans-serif", fontSize: 8, color: t.mid, textDecoration: "none" }}>Docs</a>
          <a href="#" style={{ fontFamily: "'Roboto', sans-serif", fontSize: 8, color: t.mid, textDecoration: "none" }}>GitHub</a>
          <a href="#" style={{ fontFamily: "'Roboto', sans-serif", fontSize: 8, color: t.mid, textDecoration: "none" }}>Contact</a>
        </div>
      </div>
      <div style={{ marginTop: 8, fontFamily: "'Roboto', sans-serif", fontSize: 7, color: t.low }}>
        Data sources: FEC, USAspending.gov, Federal Register, Senate/House disclosures, STOCK Act filings. Updates every 15 minutes.
      </div>
    </div>
  );
}

export default Footer;
