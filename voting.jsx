const { useState, useMemo, useRef, useEffect } = React;

function VotingAnalysis() {
    const [c1, setC1] = useState(0.2);
    const [c2, setC2] = useState(0.5);
    const [c3, setC3] = useState(0.8);
    const [dragging, setDragging] = useState(null);
    const svgRef = useRef(null);

    // Custom candidate labels
    const [label1, setLabel1] = useState('C1');
    const [label2, setLabel2] = useState('C2');
    const [label3, setLabel3] = useState('C3');

    // --- URL params handling: read initial params, respond to back/forward, and keep URL updated ---
    const parseAndApplyUrl = (replaceValues = true) => {
        try {
            const params = new URLSearchParams(window.location.search);

            const p1 = params.has('c1') ? parseFloat(params.get('c1')) : null;
            const p2 = params.has('c2') ? parseFloat(params.get('c2')) : null;
            const p3 = params.has('c3') ? parseFloat(params.get('c3')) : null;

            const l1 = params.get('l1');
            const l2 = params.get('l2');
            const l3 = params.get('l3');

            const clamp = (v) => {
                if (v === null || Number.isNaN(v)) return null;
                // round to 2 decimals, clamp to [0.01,0.99]
                return Math.round(Math.max(0.01, Math.min(0.99, v)) * 100) / 100;
            };

            let nc1 = clamp(p1);
            let nc2 = clamp(p2);
            let nc3 = clamp(p3);

            // If any missing, leave as current state (so we need to read current state values)
            if (nc1 === null) nc1 = c1;
            if (nc2 === null) nc2 = c2;
            if (nc3 === null) nc3 = c3;

            // enforce ordering and small gaps
            nc1 = Math.max(0.01, Math.min(nc1, nc2 - 0.01));
            nc2 = Math.max(nc1 + 0.01, Math.min(nc2, nc3 - 0.01));
            nc3 = Math.max(nc2 + 0.01, Math.min(nc3, 0.99));

            if (replaceValues) {
                setC1(nc1);
                setC2(nc2);
                setC3(nc3);
                if (l1 !== null) setLabel1(l1);
                if (l2 !== null) setLabel2(l2);
                if (l3 !== null) setLabel3(l3);
            }
        } catch (err) {
            console.warn('Error parsing URL params', err);
        }
    };

    // Read initial params once and respond to back/forward navigation
    useEffect(() => {
        parseAndApplyUrl(true);

        const onPop = () => parseAndApplyUrl(true);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
        // Intentionally run only once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update the URL whenever positions or labels change
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            params.set('c1', c1.toFixed(3));
            params.set('c2', c2.toFixed(3));
            params.set('c3', c3.toFixed(3));

            if (label1) params.set('l1', label1); else params.delete('l1');
            if (label2) params.set('l2', label2); else params.delete('l2');
            if (label3) params.set('l3', label3); else params.delete('l3');

            const newQuery = params.toString();
            const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
            // use replaceState so user history isn't flooded with tiny changes
            window.history.replaceState({}, '', newUrl);
        } catch (err) {
            console.warn('Error updating URL params', err);
        }
    }, [c1, c2, c3, label1, label2, label3]);

    const handlePointerDown = (point) => (e) => {
        e.preventDefault();
        setDragging(point);
    };

    const handlePointerMove = (e) => {
        if (!dragging || !svgRef.current) return;

        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();

        // Handle both mouse and touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const x = (clientX - rect.left) / rect.width;
        const clampedX = Math.max(0, Math.min(1, x));

        // Round to nearest 0.01 for cleaner values
        const roundedX = Math.round(clampedX * 100) / 100;

        if (dragging === 'c1') {
            const newC1 = Math.max(0.01, Math.min(c2 - 0.01, roundedX));
            setC1(newC1);
        } else if (dragging === 'c2') {
            const newC2 = Math.max(c1 + 0.01, Math.min(c3 - 0.01, roundedX));
            setC2(newC2);
        } else if (dragging === 'c3') {
            const newC3 = Math.max(c2 + 0.01, Math.min(0.99, roundedX));
            setC3(newC3);
        }
    };

    const handlePointerUp = () => {
        setDragging(null);
    };

    useEffect(() => {
        if (dragging) {
            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);
            document.addEventListener('touchmove', handlePointerMove);
            document.addEventListener('touchend', handlePointerUp);
            return () => {
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
                document.removeEventListener('touchmove', handlePointerMove);
                document.removeEventListener('touchend', handlePointerUp);
            };
        }
    }, [dragging, c1, c2, c3]);

    // Candidate positions (now the primary variables)
    const candidates = useMemo(() => {
        return {
            C1: c1,
            C2: c2,
            C3: c3
        };
    }, [c1, c2, c3]);

    // Calculate indifference points (where voters are equidistant)
    const indifferencePoints = useMemo(() => {
        return {
            x12: (c1 + c2) / 2,  // C1-C2 boundary
            x23: (c2 + c3) / 2,  // C2-C3 boundary
            x13: (c1 + c3) / 2   // C1-C3 boundary
        };
    }, [c1, c2, c3]);

    // Calculate voter preferences based on distance
    const voterRankings = useMemo(() => {
        const { C1, C2, C3 } = candidates;

        // Find critical points where rankings change
        const points = [0, 1, C1, C2, C3];
        const allCands = [C1, C2, C3];

        // Add midpoints between all pairs
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                points.push((allCands[i] + allCands[j]) / 2);
            }
        }

        points.sort((a, b) => a - b);

        // For each interval, determine ranking
        const rankings = [];
        for (let i = 0; i < points.length - 1; i++) {
            const voterPos = (points[i] + points[i + 1]) / 2;

            const dists = [
                { name: 'C1', dist: Math.abs(voterPos - C1) },
                { name: 'C2', dist: Math.abs(voterPos - C2) },
                { name: 'C3', dist: Math.abs(voterPos - C3) }
            ];

            dists.sort((a, b) => a.dist - b.dist);

            const ranking = dists.map(d => d.name).join('>');
            const proportion = points[i + 1] - points[i];

            const found = rankings.find(r => r.ranking === ranking);
            if (found) {
                found.proportion += proportion;
            } else {
                rankings.push({ ranking, proportion });
            }
        }

        return rankings.filter(r => r.proportion > 0.0001);
    }, [candidates]);

    // Calculate ranking regions for visualization
    const rankingRegions = useMemo(() => {
        const { C1, C2, C3 } = candidates;
        const { x12, x23, x13 } = indifferencePoints;

        // Critical points are the indifference points, sorted
        const criticalPoints = [0, x12, x13, x23, 1].sort((a, b) => a - b);

        // Remove duplicates
        const uniquePoints = [...new Set(criticalPoints)];

        // For each interval, determine ranking
        const regions = [];
        for (let i = 0; i < uniquePoints.length - 1; i++) {
            const voterPos = (uniquePoints[i] + uniquePoints[i + 1]) / 2;

            const dists = [
                { name: 'C1', dist: Math.abs(voterPos - C1) },
                { name: 'C2', dist: Math.abs(voterPos - C2) },
                { name: 'C3', dist: Math.abs(voterPos - C3) }
            ];

            dists.sort((a, b) => a.dist - b.dist);

            const ranking = dists.map(d => d.name).join('>');

            regions.push({
                start: uniquePoints[i],
                end: uniquePoints[i + 1],
                ranking
            });
        }

        return regions;
    }, [candidates, indifferencePoints]);

    // Pairwise comparisons
    const pairwise = useMemo(() => {
        const results = {};
        const names = ['C1', 'C2', 'C3'];

        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const c1 = names[i];
                const c2 = names[j];
                let c1Votes = 0;

                voterRankings.forEach(v => {
                    const ranks = v.ranking.split('>');
                    if (ranks.indexOf(c1) < ranks.indexOf(c2)) {
                        c1Votes += v.proportion;
                    }
                });

                results[c1 + ' vs ' + c2] = {
                    winner: c1Votes > 0.5 ? c1 : c2,
                    score: (Math.max(c1Votes, 1 - c1Votes) * 100).toFixed(1) + '%'
                };
            }
        }

        return results;
    }, [voterRankings]);

    // Condorcet winner and wins count
    const condorcetInfo = useMemo(() => {
        const wins = { C1: 0, C2: 0, C3: 0 };
        Object.values(pairwise).forEach(r => wins[r.winner]++);
        const maxWins = Math.max(wins.C1, wins.C2, wins.C3);

        let winner = 'None';
        for (let c of ['C1', 'C2', 'C3']) {
            if (wins[c] === 2) {
                winner = c;
                break;
            }
        }

        return { winner, wins };
    }, [pairwise]);

    // Group pairwise matchups by candidate (ordered by strength)
    const groupedPairwise = useMemo(() => {
        const candidates = ['C1', 'C2', 'C3'];
        const sortedCandidates = candidates.sort((a, b) =>
            condorcetInfo.wins[b] - condorcetInfo.wins[a]
        );

        const groups = [];
        sortedCandidates.forEach(cand => {
            const matchups = [];
            Object.entries(pairwise).forEach(([matchup, result]) => {
                if (matchup.startsWith(cand + ' vs ') || matchup.includes(' vs ' + cand)) {
                    matchups.push({ matchup, result });
                }
            });

            // Remove duplicates (each matchup appears twice)
            const uniqueMatchups = [];
            const seen = new Set();
            matchups.forEach(m => {
                const sorted = m.matchup.split(' vs ').sort().join(' vs ');
                if (!seen.has(sorted)) {
                    seen.add(sorted);
                    uniqueMatchups.push(m);
                }
            });

            groups.push({
                candidate: cand,
                wins: condorcetInfo.wins[cand],
                matchups: uniqueMatchups
            });
        });

        return groups;
    }, [pairwise, condorcetInfo]);

    // Calculate reverse Borda count (1 pt for 1st, 2 pts for 2nd, 3 pts for 3rd, etc.)
    // Higher score is worse, used for tiebreaking
    const bordaScores = useMemo(() => {
        const scores = { C1: 0, C2: 0, C3: 0 };
        const numCandidates = 3;

        voterRankings.forEach(v => {
            const ranks = v.ranking.split('>');
            ranks.forEach((cand, idx) => {
                scores[cand] += (idx + 1) * v.proportion;  // 1 pt for 1st, 2 pts for 2nd, 3 pts for 3rd
            });
        });

        return scores;
    }, [voterRankings]);

    // Borda winner (lowest score wins)
    const bordaWinner = useMemo(() => {
        const sorted = Object.entries(bordaScores).sort((a, b) => a[1] - b[1]);
        return sorted[0][0];
    }, [bordaScores]);

    // Label mapping helper
    const getLabel = (candId) => {
        const labels = { C1: label1, C2: label2, C3: label3 };
        return labels[candId] || candId;
    };

    // Convert ranking string to use custom labels (e.g., "C1>C2>C3" → "Alice>Bob>Charlie")
    const formatRanking = (ranking) => {
        return ranking.split('>').map(c => getLabel(c)).join('>');
    };

    // RCV rounds with reverse Borda tiebreaker
    const rcv = useMemo(() => {
        const rounds = [];
        let remaining = ['C1', 'C2', 'C3'];
        let voters = voterRankings.map(v => ({ ...v }));

        while (remaining.length > 1) {
            const votes = {};
            remaining.forEach(c => votes[c] = 0);

            voters.forEach(v => {
                const first = v.ranking.split('>').find(c => remaining.includes(c));
                if (first) votes[first] += v.proportion;
            });

            const round = {};
            remaining.forEach(c => round[c] = votes[c]);

            const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
            if (sorted[0][1] > 0.5) {
                rounds.push({ votes: round, eliminated: null });
                rounds.push({ winner: sorted[0][0] });
                break;
            }

            // Find minimum vote count
            const minVotes = sorted[sorted.length - 1][1];

            // Get all candidates tied for last (with epsilon for floating point comparison)
            const epsilon = 0.0001;
            const tiedForLast = sorted.filter(([c, v]) => Math.abs(v - minVotes) < epsilon).map(([c, v]) => c);

            let eliminated;
            if (tiedForLast.length === 1) {
                eliminated = tiedForLast[0];
            } else {
                // Break tie by reverse Borda count (HIGHEST score gets eliminated)
                // Find the maximum Borda score among tied candidates
                const maxBorda = Math.max(...tiedForLast.map(c => bordaScores[c]));
                eliminated = tiedForLast.find(c => bordaScores[c] === maxBorda);
            }

            rounds.push({ votes: round, eliminated });

            remaining = remaining.filter(c => c !== eliminated);
            voters = voters.map(v => ({
                ranking: v.ranking.split('>').filter(c => c !== eliminated).join('>'),
                proportion: v.proportion
            }));
        }

        return rounds;
    }, [voterRankings, bordaScores]);

    // AV critical profiles
    const avProfiles = useMemo(() => {
        const profiles = {};

        ['C1', 'C2', 'C3'].forEach(target => {
            const approvals = { C1: 0, C2: 0, C3: 0 };

            voterRankings.forEach(v => {
                const ranks = v.ranking.split('>');
                const idx = ranks.indexOf(target);

                if (idx === ranks.length - 1) {
                    // Target is last, approve only top choice
                    approvals[ranks[0]] += v.proportion;
                } else {
                    // Approve target and everyone above
                    for (let i = 0; i <= idx; i++) {
                        approvals[ranks[i]] += v.proportion;
                    }
                }
            });

            profiles[target] = approvals;
        });

        return profiles;
    }, [voterRankings]);

    const colors = ['#3B82F6', '#10B981', '#F59E0B'];

    // Copy-to-clipboard feedback state
    const [copyStatus, setCopyStatus] = useState('');

    const copyUrlToClipboard = async () => {
        try {
            const url = window.location.href;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        } catch (err) {
            console.warn('Copy failed', err);
            setCopyStatus('Failed');
            setTimeout(() => setCopyStatus(''), 2000);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui', backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#f1f5f9' }}>AVLab - Approval Voting Strategy Analyzer</h1>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px', color: '#f1f5f9' }}>
                        C1 = {c1.toFixed(3)}
                    </label>
                    <input
                        type="range"
                        min="0.01"
                        max={Math.min(0.99, c2 - 0.01)}
                        step="0.01"
                        value={c1}
                        onChange={e => setC1(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px', color: '#f1f5f9' }}>
                        C2 = {c2.toFixed(3)}
                    </label>
                    <input
                        type="range"
                        min={Math.max(0.01, c1 + 0.01)}
                        max={Math.min(0.99, c3 - 0.01)}
                        step="0.01"
                        value={c2}
                        onChange={e => setC2(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px', color: '#f1f5f9' }}>
                        C3 = {c3.toFixed(3)}
                    </label>
                    <input
                        type="range"
                        min={Math.max(0.01, c2 + 0.01)}
                        max="0.99"
                        step="0.01"
                        value={c3}
                        onChange={e => setC3(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px', color: '#f1f5f9' }}>Interval [0,1]</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>
                    <strong>Drag candidates (C1, C2, C3)</strong> to change positions. Indifference points shown in purple.
                </p>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '15px' }}>
                    Indifference points: X₁₂={(indifferencePoints.x12).toFixed(3)}, X₂₃={(indifferencePoints.x23).toFixed(3)}, X₁₃={(indifferencePoints.x13).toFixed(3)}
                </p>
                <svg ref={svgRef} width="100%" height="160" style={{ display: 'block', cursor: dragging ? 'grabbing' : 'default', touchAction: 'none', backgroundColor: '#0f172a' }}>
                    {/* Ranking regions - showing where each voter type is located */}
                    {rankingRegions.map((region, idx) => {
                        const width = (region.end - region.start) * 100;
                        const x = region.start * 100;
                        const colors = {
                            'C1>C2>C3': '#1e3a8a',
                            'C1>C3>C2': '#831843',
                            'C2>C1>C3': '#14532d',
                            'C2>C3>C1': '#713f12',
                            'C3>C1>C2': '#7c2d12',
                            'C3>C2>C1': '#3730a3'
                        };
                        return (
                            <g key={idx}>
                                <rect
                                    x={x + '%'}
                                    y="10"
                                    width={width + '%'}
                                    height="30"
                                    fill={colors[region.ranking] || '#374151'}
                                    stroke="#64748b"
                                    strokeWidth="0.5"
                                    opacity="0.8"
                                />
                                {width > 8 && (
                                    <text
                                        x={(x + width / 2) + '%'}
                                        y="28"
                                        fontSize="9"
                                        textAnchor="middle"
                                        fill="#e2e8f0"
                                        fontFamily="monospace"
                                        fontWeight="600"
                                    >
                                        {formatRanking(region.ranking)}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Main interval line */}
                    <line x1="0" y1="60" x2="100%" y2="60" stroke="#cbd5e1" strokeWidth="2" />

                    {/* Endpoint markers */}
                    <line x1="0" y1="55" x2="0" y2="65" stroke="#cbd5e1" strokeWidth="2" />
                    <text x="0" y="75" fontSize="10" textAnchor="middle" fill="#e2e8f0">0</text>

                    <line x1="50%" y1="55" x2="50%" y2="65" stroke="#cbd5e1" strokeWidth="2" />
                    <text x="50%" y="75" fontSize="10" textAnchor="middle" fill="#e2e8f0">0.5</text>

                    <line x1="100%" y1="55" x2="100%" y2="65" stroke="#cbd5e1" strokeWidth="2" />
                    <text x="100%" y="75" fontSize="10" textAnchor="end" fill="#e2e8f0">1</text>

                    {/* Indifference points (not draggable) */}
                    <g>
                        <line x1={indifferencePoints.x12 * 100 + '%'} y1="55" x2={indifferencePoints.x12 * 100 + '%'} y2="65" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2,2" />
                        <text x={indifferencePoints.x12 * 100 + '%'} y="50" fontSize="8" fill="#a78bfa" textAnchor="middle">X₁₂</text>
                    </g>

                    <g>
                        <line x1={indifferencePoints.x23 * 100 + '%'} y1="55" x2={indifferencePoints.x23 * 100 + '%'} y2="65" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2,2" />
                        <text x={indifferencePoints.x23 * 100 + '%'} y="50" fontSize="8" fill="#a78bfa" textAnchor="middle">X₂₃</text>
                    </g>

                    <g>
                        <line x1={indifferencePoints.x13 * 100 + '%'} y1="55" x2={indifferencePoints.x13 * 100 + '%'} y2="65" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2,2" />
                        <text x={indifferencePoints.x13 * 100 + '%'} y="50" fontSize="8" fill="#a78bfa" textAnchor="middle">X₁₃</text>
                    </g>

                    {/* Candidates (draggable) */}
                    <g
                        onPointerDown={handlePointerDown('c1')}
                        onTouchStart={handlePointerDown('c1')}
                        style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                        <circle cx={candidates.C1 * 100 + '%'} cy="100" r="8" fill={colors[0]} stroke="#1e293b" strokeWidth="2" opacity="0.9" />
                        <text x={candidates.C1 * 100 + '%'} y="120" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#e2e8f0">{getLabel('C1')}</text>
                    </g>

                    <g
                        onPointerDown={handlePointerDown('c2')}
                        onTouchStart={handlePointerDown('c2')}
                        style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                        <circle cx={candidates.C2 * 100 + '%'} cy="100" r="8" fill={colors[1]} stroke="#1e293b" strokeWidth="2" opacity="0.9" />
                        <text x={candidates.C2 * 100 + '%'} y="120" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#e2e8f0">{getLabel('C2')}</text>
                    </g>

                    <g
                        onPointerDown={handlePointerDown('c3')}
                        onTouchStart={handlePointerDown('c3')}
                        style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                        <circle cx={candidates.C3 * 100 + '%'} cy="100" r="8" fill={colors[2]} stroke="#1e293b" strokeWidth="2" opacity="0.9" />
                        <text x={candidates.C3 * 100 + '%'} y="120" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#e2e8f0">{getLabel('C3')}</text>
                    </g>

                    {/* Legend for ranking regions */}
                    <text x="0" y="145" fontSize="9" fill="#94a3b8">Voter Rankings by Location</text>
                </svg>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#1e3a5f', padding: '15px', borderRadius: '8px', border: '1px solid #2563eb' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#93c5fd' }}>
                        Condorcet Winner: {getLabel(condorcetInfo.winner)}
                    </h3>
                    {groupedPairwise.map((group, idx) => (
                        <div key={group.candidate}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: idx > 0 ? '8px' : '0', marginBottom: '4px', color: group.candidate === condorcetInfo.winner ? '#60a5fa' : '#cbd5e1' }}>
                                {getLabel(group.candidate)} ({group.wins} wins)
                            </div>
                            {group.matchups.map(({ matchup, result }) => {
                                const parts = matchup.split(' vs ');
                                // Ensure current candidate is always first
                                const opponent = parts[0] === group.candidate ? parts[1] : parts[0];
                                const isWinner = result.winner === group.candidate;
                                return (
                                    <div key={matchup} style={{ fontSize: '13px', marginBottom: '3px', marginLeft: '8px', color: '#e2e8f0' }}>
                                        {isWinner ? (
                                            <span><strong>{getLabel(group.candidate)}</strong> vs {getLabel(opponent)}: <strong>{getLabel(result.winner)}</strong> ({result.score})</span>
                                        ) : (
                                            <span>{getLabel(group.candidate)} vs <strong>{getLabel(opponent)}</strong>: <strong>{getLabel(result.winner)}</strong> ({result.score})</span>
                                        )}
                                    </div>
                                );
                            })}
                            {idx < groupedPairwise.length - 1 && (
                                <div style={{ borderTop: '1px solid #3b82f6', marginTop: '6px' }}></div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ backgroundColor: '#14532d', padding: '15px', borderRadius: '8px', border: '1px solid #16a34a' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#86efac' }}>
                        RCV Rounds
                        {condorcetInfo.winner !== 'None' && (
                            <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '8px', color: '#4ade80' }}>
                                (Condorcet Winner: {getLabel(condorcetInfo.winner)})
                            </span>
                        )}
                    </h3>
                    {rcv.map((round, i) => (
                        <div key={i} style={{ fontSize: '13px', marginBottom: '8px', color: '#e2e8f0' }}>
                            {round.winner ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '16px' }}>🥇</span>
                                    <strong style={{ color: '#4ade80' }}>Winner: {getLabel(round.winner)}</strong>
                                    {round.winner === condorcetInfo.winner && condorcetInfo.winner !== 'None' && (
                                        <span style={{ fontSize: '16px' }}>🏆</span>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '3px' }}>Round {i + 1}:</div>
                                    {Object.entries(round.votes).sort((a, b) => b[1] - a[1]).map(([c, v], idx) => (
                                        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '32px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '2px' }}>
                                                    {round.eliminated === c && <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '16px' }}>✗</span>}
                                                    {idx === 0 && !round.eliminated && <span style={{ fontSize: '14px' }}>⭐</span>}
                                                    {c === condorcetInfo.winner && condorcetInfo.winner !== 'None' && (
                                                        <span style={{ fontSize: '14px' }}>🏆</span>
                                                    )}
                                                </div>
                                                <div style={{ minWidth: '60px' }}>{getLabel(c)}</div>
                                                <div>{(v * 100).toFixed(1)}%</div>
                                            </div>
                                            {round.eliminated === c && c === condorcetInfo.winner && condorcetInfo.winner !== 'None' && (
                                                <div style={{ fontSize: '11px', color: '#fbbf24', fontStyle: 'italic' }}>(Condorcet Winner Eliminated)</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ backgroundColor: '#78350f', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #f59e0b' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#fde68a' }}>Voter Rankings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    {voterRankings.sort((a, b) => b.proportion - a.proportion).map(v => (
                        <div key={v.ranking} style={{ fontSize: '13px', color: '#e2e8f0' }}>
                            <span style={{ fontFamily: 'monospace' }}>{formatRanking(v.ranking)}</span>: {(v.proportion * 100).toFixed(1)}%
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ backgroundColor: '#581c87', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #a855f7' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px', color: '#e9d5ff' }}>
                    Reverse Borda Scores - Winner: {getLabel(bordaWinner)} 🏆
                </h3>
                <p style={{ fontSize: '11px', color: '#d8b4fe', marginBottom: '10px' }}>
                    1 pt for 1st place, 2 pts for 2nd, 3 pts for 3rd. Lower = better (used for RCV tiebreaking).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
                    {Object.entries(bordaScores)
                        .sort((a, b) => a[1] - b[1])
                        .map(([cand, score]) => (
                            <div key={cand} style={{ backgroundColor: '#4c1d95', padding: '12px', borderRadius: '6px', textAlign: 'center', border: cand === bordaWinner ? '2px solid #a855f7' : '1px solid #7c3aed' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#e9d5ff' }}>
                                    {getLabel(cand)}
                                    {cand === bordaWinner && <span style={{ marginLeft: '4px' }}>🏆</span>}
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#c084fc' }}>
                                    {score.toFixed(3)}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            <div style={{ backgroundColor: '#7c2d12', padding: '15px', borderRadius: '8px', border: '1px solid #f97316' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#fed7aa' }}>AV Critical Profiles</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
                    {Object.entries(avProfiles).map(([target, app]) => {
                        const sorted = Object.entries(app).sort((a, b) => b[1] - a[1]);
                        const winner = sorted[0][0];
                        return (
                            <div key={target} style={{ backgroundColor: '#431407', padding: '12px', borderRadius: '6px', border: '1px solid #ea580c' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#fed7aa' }}>{getLabel(target)} Critical</div>
                                {sorted.map(([c, a]) => (
                                    <div key={c} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                        <span style={{ width: '50px', fontSize: '13px', fontWeight: c === winner ? 'bold' : 'normal', color: '#e2e8f0' }}>{getLabel(c)}:</span>
                                        <div style={{ flex: 1, height: '14px', backgroundColor: '#1e293b', borderRadius: '7px', overflow: 'hidden', marginRight: '8px' }}>
                                            <div style={{ width: (a * 100) + '%', height: '100%', backgroundColor: c === winner ? '#fb923c' : '#64748b' }}></div>
                                        </div>
                                        <span style={{ fontSize: '12px', width: '45px', fontWeight: c === winner ? 'bold' : 'normal', color: '#e2e8f0' }}>
                                            {(a * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                                <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 'bold', color: '#fed7aa' }}>Winner: {getLabel(winner)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', marginTop: '20px', border: '1px solid #0ea5e9' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#7dd3fc' }}>Custom Candidate Labels</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            C1 Label:
                        </label>
                        <input
                            type="text"
                            value={label1}
                            onChange={(e) => setLabel1(e.target.value)}
                            placeholder="C1"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            C2 Label:
                        </label>
                        <input
                            type="text"
                            value={label2}
                            onChange={(e) => setLabel2(e.target.value)}
                            placeholder="C2"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            C3 Label:
                        </label>
                        <input
                            type="text"
                            value={label3}
                            onChange={(e) => setLabel3(e.target.value)}
                            placeholder="C3"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                        />
                    </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={copyUrlToClipboard} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#0891b2', border: 'none', color: '#e6fffa', fontWeight: '600', cursor: 'pointer' }}>
                        Copy URL
                    </button>
                    <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{copyStatus}</span>
                </div>
            </div>
        </div>
    );
}

// Expose component to global scope so `index.html` can render it
window.VotingAnalysis = VotingAnalysis;