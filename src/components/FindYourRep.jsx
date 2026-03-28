import { useState } from 'react';
import { useTheme } from '../theme/index.js';
import { Card, Band, CardTitle } from './ui/index.js';
import { campaignWatch as cwApi } from '../api/client.js';

export default function FindYourRep() {
  const t = useTheme();
  const [addressInput, setAddressInput] = useState('');
  const [repsLoading,  setRepsLoading]  = useState(false);
  const [repsData,     setRepsData]     = useState(null);
  const [repsNote,     setRepsNote]     = useState(null);
  const [repsError,    setRepsError]    = useState(null);

  const searchRepresentatives = async () => {
    const addr = addressInput.trim();
    if (addr.length < 2) return;
    setRepsLoading(true);
    setRepsError(null);
    setRepsData(null);
    setRepsNote(null);
    try {
      const res = await cwApi.repsByAddress(addr);
      if (res?.data) {
        setRepsData(res.data);
        if (res.note) setRepsNote(res.note);
      } else if (res?.note) {
        setRepsError(res.note);
      } else {
        setRepsError('No representatives found. Try including a state abbreviation (e.g. "Union City NJ") or zip code.');
      }
    } catch (e) {
      setRepsError(e.message || 'Failed to look up representatives.');
    } finally {
      setRepsLoading(false);
    }
  };

  return (
    <div>
      <Band label="Find Your Representatives" right="CONGRESS.GOV + GOOGLE CIVIC" />
      <Card>
        <CardTitle
          h="Look up your elected officials by address, zip code, or state."
          sub="Enter a full address or a zip code (10017), or just a state abbreviation (NJ)."
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchRepresentatives()}
            placeholder="115 37th Ave Union City NJ  —  07087  —  NJ"
            style={{
              flex: 1, padding: '10px 14px',
              background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4,
              color: t.hi, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, outline: 'none',
            }}
          />
          <button
            onClick={searchRepresentatives}
            disabled={repsLoading || addressInput.trim().length < 2}
            style={{
              padding: '10px 20px',
              background: (repsLoading || addressInput.trim().length < 2) ? t.cardB : t.accent,
              border: `1px solid ${t.border}`, borderRadius: 4,
              color: (repsLoading || addressInput.trim().length < 2) ? t.mid : '#fff',
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
              cursor: repsLoading ? 'wait' : 'pointer', letterSpacing: '1px',
            }}
          >
            {repsLoading ? 'SEARCHING…' : 'FIND REPS'}
          </button>
        </div>

        {repsNote && (
          <div style={{ padding: '8px 14px', background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: t.low, marginBottom: 14 }}>
            ℹ {repsNote}
          </div>
        )}

        {repsError && (
          <div style={{ padding: '10px 14px', background: t.cardB, border: `1px solid ${t.warn}`, borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.warn, marginBottom: 16 }}>
            ⚠ {repsError}
          </div>
        )}

        {repsData && (
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.low, marginBottom: 14, letterSpacing: '1px' }}>
              {repsData.source === 'congress.gov'
                ? `FEDERAL REPRESENTATIVES — ${repsData.normalizedInput?.line1 || addressInput}`
                : `RESULTS FOR: ${repsData.normalizedInput?.line1 || ''}${repsData.normalizedInput?.city ? `, ${repsData.normalizedInput.city}` : ''}${repsData.normalizedInput?.state ? ` ${repsData.normalizedInput.state}` : ''}`
              }
            </div>

            {(repsData.officials || []).length === 0 ? (
              <div style={{ padding: '12px 14px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.mid }}>
                No officials found for this location.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {(repsData.officials || []).map((rep, i) => {
                  const party = rep.party || '';
                  const partyLower = party.toLowerCase();
                  const partyColor = partyLower.includes('republican') ? '#ef4444'
                                   : partyLower.includes('democrat')   ? '#3b82f6'
                                   : t.mid;
                  return (
                    <div key={i} style={{
                      padding: 14,
                      background: t.cardB, border: `1px solid ${t.border}`,
                      borderTop: `3px solid ${partyColor}`, borderRadius: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {rep.photoUrl && (
                          <img src={rep.photoUrl} alt={rep.name}
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${partyColor}` }}
                            onError={e => { e.target.style.display='none'; }}
                          />
                        )}
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: t.hi, fontWeight: 700 }}>{rep.name}</div>
                          {rep.office && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 2 }}>{rep.office}</div>}
                        </div>
                      </div>
                      {party && (
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: partyColor, marginBottom: 6 }}>{party}</div>
                      )}
                      {rep.channels?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          {rep.channels.slice(0, 3).map((ch, j) => (
                            <a key={j}
                              href={`https://${ch.type.toLowerCase()}.com/${ch.id}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.blue, textDecoration: 'none', border: `1px solid ${t.border}`, padding: '2px 6px', borderRadius: 3 }}>
                              {ch.type}
                            </a>
                          ))}
                        </div>
                      )}
                      {rep.phones?.length > 0 && (
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.mid, marginTop: 4 }}>
                          📞 {rep.phones[0]}
                        </div>
                      )}
                      {rep.urls?.length > 0 && (
                        <a href={rep.urls[0]} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', marginTop: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: t.blue, textDecoration: 'none' }}>
                          🌐 Official website
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!repsData && !repsError && !repsLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {['Federal Senator', 'Federal Representative', 'Governor'].map(role => (
              <div key={role} style={{
                padding: 16, background: t.cardB, border: `1px solid ${t.border}`, borderRadius: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minHeight: 80,
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: t.accent, letterSpacing: '1px' }}>{role.toUpperCase()}</div>
                <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 11, fontStyle: 'italic', color: t.low }}>Enter address, zip, or state</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
