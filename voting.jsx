const { useState, useMemo, useRef, useEffect } = React;

function VotingAnalysis() {
    const [numCandidates, setNumCandidates] = useState(3);
    const [c1, setC1] = useState(0.2);
    const [c2, setC2] = useState(0.5);
    const [c3, setC3] = useState(0.8);
    const [c4, setC4] = useState(0.95);
    const [dragging, setDragging] = useState(null);
    const svgRef = useRef(null);
    const hasInitializedRef = useRef(false);

    // Custom candidate labels
    const [label1, setLabel1] = useState('A');
    const [label2, setLabel2] = useState('B');
    const [label3, setLabel3] = useState('C');
    const [label4, setLabel4] = useState('D');

    // --- URL params handling: read initial params, respond to back/forward, and keep URL updated ---
    const parseAndApplyUrl = (replaceValues = true) => {
        try {
            const params = new URLSearchParams(window.location.search);

            const pn = params.has('n') ? parseInt(params.get('n')) : null;
            const p1 = params.has('c1') ? parseFloat(params.get('c1')) : null;
            const p2 = params.has('c2') ? parseFloat(params.get('c2')) : null;
            const p3 = params.has('c3') ? parseFloat(params.get('c3')) : null;
            const p4 = params.has('c4') ? parseFloat(params.get('c4')) : null;

            const l1 = params.get('l1');
            const l2 = params.get('l2');
            const l3 = params.get('l3');
            const l4 = params.get('l4');

            const st = params.has('st') ? parseFloat(params.get('st')) : null;
            const bs = params.has('bs') ? (params.get('bs') === '1' || params.get('bs') === 'true') : null;

            const clamp = (v) => {
                if (v === null || Number.isNaN(v)) return null;
                // round to 2 decimals, clamp to [0.01,0.99]
                return Math.round(Math.max(0.01, Math.min(0.99, v)) * 100) / 100;
            };

            let nn = pn !== null ? Math.max(2, Math.min(4, pn)) : numCandidates;
            let nc1 = clamp(p1);
            let nc2 = clamp(p2);
            let nc3 = clamp(p3);
            let nc4 = clamp(p4);

            // If any missing, leave as current state (so we need to read current state values)
            if (nc1 === null) nc1 = c1;
            if (nc2 === null) nc2 = c2;
            if (nc3 === null) nc3 = c3;
            if (nc4 === null) nc4 = c4;

            // No ordering enforcement - allow candidates to be in any order
            // The candidates useMemo will handle sorting for display

            if (replaceValues) {
                setNumCandidates(nn);
                setC1(nc1);
                setC2(nc2);
                setC3(nc3);
                setC4(nc4);
                if (l1 !== null) setLabel1(l1);
                if (l2 !== null) setLabel2(l2);
                if (l3 !== null) setLabel3(l3);
                if (l4 !== null) setLabel4(l4);
                if (st !== null && !Number.isNaN(st)) {
                    setSincereThreshold(Math.max(0.01, Math.min(1.0, st)));
                }
                if (bs !== null) {
                    setUseBasicStrategy(Boolean(bs));
                }

                // Async update rate
                const au = parseFloat(params.get('au'));
                if (au !== null && !Number.isNaN(au) && au >= 0.1 && au <= 1.0) {
                    setAsyncUpdateRate(au);
                }

                // Sincere voter proportion
                const sv = parseFloat(params.get('sv'));
                if (sv !== null && !Number.isNaN(sv) && sv >= 0.0 && sv <= 1.0) {
                    setSincereVoterProportion(sv);
                }
            }
        } catch (err) {
            console.warn('Error parsing URL params', err);
        }
    };

    // Helper to update a single URL param immediately (used by sliders)
    const updateUrlParam = (key, value) => {
        try {
            const params = new URLSearchParams(window.location.search);
            if (value === null || value === undefined) params.delete(key);
            else params.set(key, value);
            const newQuery = params.toString();
            const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
            window.history.replaceState({}, '', newUrl);
        } catch (err) {
            console.warn('Error updating single URL param', err);
        }
    };

    // Read initial params once and respond to back/forward navigation
    useEffect(() => {
        parseAndApplyUrl(true);
        hasInitializedRef.current = true;

        const onPop = () => parseAndApplyUrl(true);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
        // Intentionally run only once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update the URL whenever positions or labels change
    useEffect(() => {
        // Don't update URL on initial mount (let parseAndApplyUrl run first)
        if (!hasInitializedRef.current) return;

        try {
            const params = new URLSearchParams(window.location.search);
            params.set('n', numCandidates.toString());
            params.set('c1', c1.toFixed(3));
            params.set('c2', c2.toFixed(3));
            if (numCandidates >= 3) params.set('c3', c3.toFixed(3));
            else params.delete('c3');
            if (numCandidates >= 4) params.set('c4', c4.toFixed(3));
            else params.delete('c4');

            if (label1) params.set('l1', label1); else params.delete('l1');
            if (label2) params.set('l2', label2); else params.delete('l2');
            if (label3 && numCandidates >= 3) params.set('l3', label3); else params.delete('l3');
            if (label4 && numCandidates >= 4) params.set('l4', label4); else params.delete('l4');

            params.set('st', sincereThreshold.toFixed(3));
            params.set('bs', useBasicStrategy ? '1' : '0');
            params.set('au', asyncUpdateRate.toFixed(1));
            params.set('sv', sincereVoterProportion.toFixed(1));

            const newQuery = params.toString();
            const newUrl = window.location.pathname + (newQuery ? '?' + newQuery : '');
            // use replaceState so user history isn't flooded with tiny changes
            window.history.replaceState({}, '', newUrl);
        } catch (err) {
            console.warn('Error updating URL params', err);
        }
    }, [numCandidates, c1, c2, c3, c4, label1, label2, label3, label4, sincereThreshold, useBasicStrategy, asyncUpdateRate, sincereVoterProportion]);

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
        const clampedX = Math.max(0.01, Math.min(0.99, x));

        // Round to nearest 0.01 for cleaner values
        const roundedX = Math.round(clampedX * 100) / 100;

        // Allow candidates to be dragged freely across each other
        if (dragging === 'c1') {
            setC1(roundedX);
        } else if (dragging === 'c2') {
            setC2(roundedX);
        } else if (dragging === 'c3' && numCandidates >= 3) {
            setC3(roundedX);
        } else if (dragging === 'c4' && numCandidates >= 4) {
            setC4(roundedX);
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
    }, [dragging, c1, c2, c3, c4, numCandidates]);

    // Candidate positions (now the primary variables)
    const candidates = useMemo(() => {
        const positions = [
            { id: 'C1', pos: c1 },
            { id: 'C2', pos: c2 }
        ];
        if (numCandidates >= 3) positions.push({ id: 'C3', pos: c3 });
        if (numCandidates >= 4) positions.push({ id: 'C4', pos: c4 });

        // Sort by position to maintain left-to-right ordering
        positions.sort((a, b) => a.pos - b.pos);

        const result = {};
        positions.forEach(p => result[p.id] = p.pos);
        return result;
    }, [c1, c2, c3, c4, numCandidates]);

    // Calculate indifference points (where voters are equidistant)
    const indifferencePoints = useMemo(() => {
        const points = {
            x12: (c1 + c2) / 2
        };
        if (numCandidates >= 3) {
            points.x23 = (c2 + c3) / 2;
            points.x13 = (c1 + c3) / 2;
        }
        if (numCandidates >= 4) {
            points.x34 = (c3 + c4) / 2;
            points.x14 = (c1 + c4) / 2;
            points.x24 = (c2 + c4) / 2;
        }
        return points;
    }, [c1, c2, c3, c4, numCandidates]);

    // Calculate voter preferences based on distance
    const voterRankings = useMemo(() => {
        const candNames = Object.keys(candidates);
        const candPositions = Object.values(candidates);

        // Find critical points where rankings change
        const points = [0, 1, ...candPositions];

        // Add midpoints between all pairs
        for (let i = 0; i < candPositions.length; i++) {
            for (let j = i + 1; j < candPositions.length; j++) {
                points.push((candPositions[i] + candPositions[j]) / 2);
            }
        }

        points.sort((a, b) => a - b);

        // For each interval, determine ranking
        const rankings = [];
        for (let i = 0; i < points.length - 1; i++) {
            const voterPos = (points[i] + points[i + 1]) / 2;

            const dists = candNames.map(name => ({
                name,
                dist: Math.abs(voterPos - candidates[name])
            }));

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
        const candNames = Object.keys(candidates);
        const criticalPoints = [0, ...Object.values(indifferencePoints), 1].sort((a, b) => a - b);

        // Remove duplicates
        const uniquePoints = [...new Set(criticalPoints)];

        // For each interval, determine ranking
        const regions = [];
        for (let i = 0; i < uniquePoints.length - 1; i++) {
            const voterPos = (uniquePoints[i] + uniquePoints[i + 1]) / 2;

            const dists = candNames.map(name => ({
                name,
                dist: Math.abs(voterPos - candidates[name])
            }));

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
        const names = Object.keys(candidates);

        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
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
    }, [voterRankings, candidates]);

    // Condorcet winner and wins count
    const condorcetInfo = useMemo(() => {
        const names = Object.keys(candidates);
        const wins = {};
        names.forEach(name => wins[name] = 0);

        Object.values(pairwise).forEach(r => wins[r.winner]++);
        const maxWins = Math.max(...Object.values(wins));

        let winner = 'None';
        for (let c of names) {
            if (wins[c] === names.length - 1) {
                winner = c;
                break;
            }
        }

        return { winner, wins };
    }, [pairwise, candidates]);

    // Group pairwise matchups by candidate (ordered by strength)
    const groupedPairwise = useMemo(() => {
        const candNames = Object.keys(candidates);
        const sortedCandidates = candNames.sort((a, b) =>
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
    }, [pairwise, condorcetInfo, candidates]);

    // Calculate reverse Borda count (1 pt for 1st, 2 pts for 2nd, 3 pts for 3rd, etc.)
    // Higher score is worse, used for tiebreaking
    const bordaScores = useMemo(() => {
        const names = Object.keys(candidates);
        const scores = {};
        names.forEach(name => scores[name] = 0);

        voterRankings.forEach(v => {
            const ranks = v.ranking.split('>');
            ranks.forEach((cand, idx) => {
                scores[cand] += (idx + 1) * v.proportion;  // 1 pt for 1st, 2 pts for 2nd, 3 pts for 3rd
            });
        });

        return scores;
    }, [voterRankings, candidates]);

    // Borda winner (lowest score wins)
    const bordaWinner = useMemo(() => {
        const sorted = Object.entries(bordaScores).sort((a, b) => a[1] - b[1]);
        return sorted[0][0];
    }, [bordaScores]);

    // Label mapping helper
    const getLabel = (candId) => {
        const labels = { C1: label1, C2: label2, C3: label3, C4: label4 };
        return labels[candId] || candId;
    };

    // Convert ranking string to use custom labels (e.g., "C1>C2>C3" → "Alice>Bob>Charlie")
    const formatRanking = (ranking) => {
        return ranking.split('>').map(c => getLabel(c)).join('>');
    };

    // Convert ranking to use first letter only (for compact display in regions)
    const formatRankingCompact = (ranking) => {
        return ranking.split('>').map(c => getLabel(c).charAt(0)).join('>');
    };

    // RCV rounds with reverse Borda tiebreaker
    const rcv = useMemo(() => {
        const rounds = [];
        let remaining = Object.keys(candidates);
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
    }, [voterRankings, bordaScores, candidates]);

    // AV critical profiles
    const avProfiles = useMemo(() => {
        const profiles = {};
        const names = Object.keys(candidates);

        names.forEach(target => {
            const approvals = {};
            names.forEach(name => approvals[name] = 0);

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
    }, [voterRankings, candidates]);

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

    // Add/Remove candidates handler
    const addCandidate = () => {
        if (numCandidates < 4) {
            setNumCandidates(numCandidates + 1);
            // Adjust positions if needed to maintain spacing
            if (numCandidates === 2) {
                // Adding C3, make sure there's space
                if (c3 - c2 < 0.01) {
                    setC3(Math.min(0.99, c2 + 0.1));
                }
            } else if (numCandidates === 3) {
                // Adding C4, make sure there's space
                if (c4 - c3 < 0.01) {
                    setC4(Math.min(0.99, c3 + 0.05));
                }
            }
        }
    };

    const removeCandidate = () => {
        if (numCandidates > 2) {
            setNumCandidates(numCandidates - 1);
        }
    };

    // Monte Carlo simulation state
    const [numSimulations, setNumSimulations] = useState(1000);
    const [distributionType, setDistributionType] = useState('uniform'); // 'uniform' or 'normal'

    // Sincere threshold simulation state
    const [sincereThreshold, setSincereThreshold] = useState(0.15);
    const [numVoters, setNumVoters] = useState(10000);
    const [useBasicStrategy, setUseBasicStrategy] = useState(false);
    const sincereMCSimulations = 100;
    const [sincereMCResults, setSincereMCResults] = useState(null);

    // Turn-based simulation state
    const [turnBasedResults, setTurnBasedResults] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [voterSeed, setVoterSeed] = useState(0); // For redistributing voters
    const [asyncUpdateRate, setAsyncUpdateRate] = useState(0.4); // Fraction of voters that update per step
    const [sincereVoterProportion, setSincereVoterProportion] = useState(0.0); // Proportion of voters who never change strategy

    // Monte Carlo simulation for approval voting
    const monteCarloResults = useMemo(() => {
        const results = { C1: 0, C2: 0, C3: 0, C4: 0 };

        for (let sim = 0; sim < numSimulations; sim++) {
            const approvals = { C1: 0, C2: 0, C3: 0, C4: 0 };

            // For each simulation, assign each voter bloc a probability of approving candidates
            voterRankings.forEach(v => {
                const ranks = v.ranking.split('>');

                // Always approve top choice (rank 0)
                approvals[ranks[0]] += v.proportion;

                // For ranks 1 through second-to-last, draw probabilities
                // Never approve the last-ranked candidate
                for (let i = 1; i < ranks.length - 1; i++) {
                    let prob;
                    if (distributionType === 'uniform') {
                        prob = Math.random(); // uniform [0,1]
                    } else {
                        // normal distribution, mean=0.5, std=0.2, clamped to [0,1]
                        const u1 = Math.random();
                        const u2 = Math.random();
                        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                        prob = Math.max(0, Math.min(1, 0.5 + 0.2 * z));
                    }

                    // Apply this probability to the entire bloc
                    approvals[ranks[i]] += v.proportion * prob;
                }
            });

            // Find winner
            const sorted = Object.entries(approvals).sort((a, b) => b[1] - a[1]);
            results[sorted[0][0]]++;
        }

        return results;
    }, [voterRankings, numSimulations, distributionType]);

    // Copy-to-clipboard feedback state
    const [copyStatus, setCopyStatus] = useState('');

    // Sincere threshold simulation - generates voters and computes results
    const sincereThresholdResults = useMemo(() => {
        const candNames = Object.keys(candidates);
        const candPositions = candNames.map(name => candidates[name]);

        // Simple seeded random number generator
        const seededRandom = (seed) => {
            let state = seed;
            return () => {
                state = (state * 1664525 + 1013904223) % 4294967296;
                return state / 4294967296;
            };
        };
        const rng = seededRandom(voterSeed);

        // Generate uniformly distributed voters
        const voters = [];
        for (let i = 0; i < numVoters; i++) {
            voters.push(rng());
        }

        // Calculate approval votes for each voter
        const approvalCounts = {};
        candNames.forEach(name => approvalCounts[name] = 0);

        const votesPerVoter = []; // Track how many candidates each voter approves

        voters.forEach(voterPos => {
            // Calculate distances to all candidates
            const distances = candNames.map((name, idx) => ({
                name,
                distance: Math.abs(voterPos - candPositions[idx])
            }));

            // Sort by distance
            distances.sort((a, b) => a.distance - b.distance);

            let approvedCount = 0;

            if (useBasicStrategy) {
                // Always approve closest, never approve furthest
                approvalCounts[distances[0].name]++;
                approvedCount++;

                // Check middle candidates against threshold
                for (let i = 1; i < distances.length - 1; i++) {
                    if (distances[i].distance <= sincereThreshold) {
                        approvalCounts[distances[i].name]++;
                        approvedCount++;
                    }
                }
            } else {
                // Approve all candidates within threshold (could be 0 or all)
                distances.forEach(d => {
                    if (d.distance <= sincereThreshold) {
                        approvalCounts[d.name]++;
                        approvedCount++;
                    }
                });
            }

            votesPerVoter.push(approvedCount);
        });

        // Find winner
        const sorted = Object.entries(approvalCounts).sort((a, b) => b[1] - a[1]);
        const winner = sorted[0][0];
        const maxVotes = sorted[0][1];

        // Count distribution of votes per voter
        const votesDistribution = {};
        for (let i = 0; i <= candNames.length; i++) {
            votesDistribution[i] = 0;
        }
        votesPerVoter.forEach(count => {
            votesDistribution[count]++;
        });

        return {
            approvalCounts,
            winner,
            maxVotes,
            votesDistribution,
            totalVoters: numVoters,
            voters // Return voters array for turn-based simulation
        };
    }, [candidates, sincereThreshold, numVoters, useBasicStrategy, voterSeed]);

    // Run Monte Carlo simulation for sincere threshold
    const runSincereMonteCarlo = () => {
        const candNames = Object.keys(candidates);
        const candPositions = candNames.map(name => candidates[name]);
        const winCounts = {};
        candNames.forEach(name => winCounts[name] = 0);

        for (let sim = 0; sim < sincereMCSimulations; sim++) {
            // Generate uniformly distributed voters for this simulation
            const voters = [];
            for (let i = 0; i < numVoters; i++) {
                voters.push(Math.random());
            }

            // Calculate approval votes for each voter
            const approvalCounts = {};
            candNames.forEach(name => approvalCounts[name] = 0);

            voters.forEach(voterPos => {
                // Calculate distances to all candidates
                const distances = candNames.map((name, idx) => ({
                    name,
                    distance: Math.abs(voterPos - candPositions[idx])
                }));

                // Sort by distance
                distances.sort((a, b) => a.distance - b.distance);

                if (useBasicStrategy) {
                    // Always approve closest, never approve furthest
                    approvalCounts[distances[0].name]++;

                    // Check middle candidates against threshold
                    for (let i = 1; i < distances.length - 1; i++) {
                        if (distances[i].distance <= sincereThreshold) {
                            approvalCounts[distances[i].name]++;
                        }
                    }
                } else {
                    // Approve all candidates within threshold
                    distances.forEach(d => {
                        if (d.distance <= sincereThreshold) {
                            approvalCounts[d.name]++;
                        }
                    });
                }
            });

            // Find winner for this simulation
            const sorted = Object.entries(approvalCounts).sort((a, b) => b[1] - a[1]);
            winCounts[sorted[0][0]]++;
        }

        setSincereMCResults(winCounts);
    };

    // Run turn-based AV strategy simulation
    const runTurnBasedSimulation = () => {
        const candNames = Object.keys(candidates);
        const candPositions = candNames.map(name => candidates[name]);
        const voters = sincereThresholdResults.voters;

        const maxSteps = 50;
        const epsilon = 0.001;
        const steps = [];

        // Simple seeded random number generator (needed for async updates)
        const seededRandom = (seed) => {
            let state = seed;
            return () => {
                state = (state * 1664525 + 1013904223) % 4294967296;
                return state / 4294967296;
            };
        };

        // Step 0: Initial sincere voting with current threshold
        let currentThresholds = voters.map(() => sincereThreshold);

        const computeStep = (thresholds) => {
            const approvalCounts = {};
            candNames.forEach(name => approvalCounts[name] = 0);

            const votesPerVoter = [];
            const ballotCounts = {}; // Track unique ballots and their counts

            voters.forEach((voterPos, voterIdx) => {
                const voterThreshold = thresholds[voterIdx];

                // Calculate distances to all candidates
                const distances = candNames.map((name, idx) => ({
                    name,
                    distance: Math.abs(voterPos - candPositions[idx])
                }));

                distances.sort((a, b) => a.distance - b.distance);

                let approvedCount = 0;
                const approvedCandidates = [];

                if (useBasicStrategy) {
                    // Always approve closest, never approve furthest
                    approvalCounts[distances[0].name]++;
                    approvedCandidates.push(distances[0].name);
                    approvedCount++;

                    // Check middle candidates against threshold
                    for (let i = 1; i < distances.length - 1; i++) {
                        if (distances[i].distance <= voterThreshold) {
                            approvalCounts[distances[i].name]++;
                            approvedCandidates.push(distances[i].name);
                            approvedCount++;
                        }
                    }
                } else {
                    // Approve all candidates within threshold
                    distances.forEach(d => {
                        if (d.distance <= voterThreshold) {
                            approvalCounts[d.name]++;
                            approvedCandidates.push(d.name);
                            approvedCount++;
                        }
                    });
                }

                votesPerVoter.push(approvedCount);

                // Create ballot key ordered by voter's preference (distances already sorted)
                const ballotKey = approvedCandidates.join(',');
                if (ballotKey) { // Only count non-empty ballots
                    ballotCounts[ballotKey] = (ballotCounts[ballotKey] || 0) + 1;
                }
            });

            // Find winner and viable candidates (within margin of error of 1st place)
            const sorted = Object.entries(approvalCounts).sort((a, b) => b[1] - a[1]);
            const winner = sorted[0][0];
            const firstPlaceVotes = sorted[0][1];
            const marginOfError = 0.03; // 3% margin

            // Include all candidates within MOE of first place
            const threshold = firstPlaceVotes * (1 - marginOfError);
            const viableCandidates = sorted
                .filter(([cand, votes]) => votes >= threshold)
                .map(([cand, votes]) => cand);

            // Count votes distribution
            const votesDistribution = {};
            for (let i = 0; i <= candNames.length; i++) {
                votesDistribution[i] = 0;
            }
            votesPerVoter.forEach(count => votesDistribution[count]++);

            // Calculate mean ballot size
            const meanBallotSize = votesPerVoter.reduce((sum, v) => sum + v, 0) / voters.length;

            return {
                approvalCounts,
                winner,
                viableCandidates,
                votesDistribution,
                meanBallotSize,
                ballotCounts
            };
        };

        // Compute initial step
        const step0 = computeStep(currentThresholds);
        steps.push({
            stepNumber: 0,
            ...step0,
            thresholds: [...currentThresholds]
        });

        // Iterate until convergence
        for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
            const prevStep = steps[steps.length - 1];

            // Each voter adjusts threshold strategically
            // Viable = within 3% margin of error of first place
            const newThresholds = voters.map((voterPos, voterIdx) => {
                const allDistances = candNames.map(candName => ({
                    name: candName,
                    distance: Math.abs(voterPos - candidates[candName])
                }));
                allDistances.sort((a, b) => a.distance - b.distance);
                const closest = allDistances[0].name;
                const closestDist = allDistances[0].distance;
                const furthest = allDistances[allDistances.length - 1].name;
                const furthestDist = allDistances[allDistances.length - 1].distance;

                if (prevStep.viableCandidates.length === 1) {
                    // Only one viable candidate (clear frontrunner)
                    const frontrunner = prevStep.viableCandidates[0];
                    const frontrunnerDist = Math.abs(voterPos - candidates[frontrunner]);

                    if (closest === frontrunner) {
                        // Case 1: Frontrunner is first choice - bullet vote (approve only frontrunner)
                        return frontrunnerDist + epsilon;
                    } else if (frontrunnerDist <= sincereThreshold) {
                        // Case 2: Frontrunner not first but within sincere threshold
                        // Approve frontrunner and everyone preferred to them (but not least favorite)
                        return Math.min(frontrunnerDist + epsilon, furthestDist - epsilon);
                    } else {
                        // Case 3: Frontrunner not in sincere threshold
                        // Approve everyone strictly preferred to frontrunner (but not least favorite)
                        return Math.min(frontrunnerDist - epsilon, furthestDist - epsilon);
                    }
                } else {
                    // Multiple viable candidates
                    // Strategy: approve closest viable candidate (but never least favorite)
                    const viableDistances = prevStep.viableCandidates.map(candName => ({
                        name: candName,
                        distance: Math.abs(voterPos - candidates[candName])
                    }));
                    viableDistances.sort((a, b) => a.distance - b.distance);
                    const closestViableDist = viableDistances[0].distance;

                    return Math.min(closestViableDist + epsilon, furthestDist - epsilon);
                }
            });

            // Apply asynchronous updates: only update a fraction of voters
            const updatedThresholds = voters.map((voterPos, voterIdx) => {
                // Check if this voter is a sincere voter (never changes strategy)
                const sincereRng = seededRandom(voterSeed * 10000 + voterIdx);
                const isSincereVoter = sincereRng() < sincereVoterProportion;

                if (isSincereVoter) {
                    // Sincere voters always use initial sincere threshold
                    return sincereThreshold;
                }

                // For strategic voters: randomly decide if this voter updates
                // (async rate applies only to strategic voters)
                const rng = seededRandom(voterSeed + stepNum * 1000 + voterIdx);
                if (rng() < asyncUpdateRate) {
                    return newThresholds[voterIdx];
                } else {
                    // Keep previous threshold
                    return prevStep.thresholds[voterIdx];
                }
            });

            const currentStep = computeStep(updatedThresholds);
            steps.push({
                stepNumber: stepNum,
                ...currentStep,
                thresholds: [...updatedThresholds]
            });

            // Check for convergence: no voter changed their ballot
            // Compare ballot counts between steps - if identical, no one changed
            const prevBallots = Object.keys(prevStep.ballotCounts).sort().join('|');
            const currBallots = Object.keys(currentStep.ballotCounts).sort().join('|');
            const ballotsMatch = prevBallots === currBallots &&
                Object.keys(prevStep.ballotCounts).every(
                    ballot => prevStep.ballotCounts[ballot] === currentStep.ballotCounts[ballot]
                );

            if (ballotsMatch) {
                break;
            }
        }

        setTurnBasedResults(steps);
        setCurrentStep(steps.length - 1); // Show final step by default
    };

    const redistributeVoters = () => {
        setVoterSeed(prev => prev + 1);
        setTurnBasedResults(null);
        setSincereMCResults(null);
        setCurrentStep(0);
    };

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

    const resetToDefaults = () => {
        // Reset all state to defaults
        setNumCandidates(3);
        setC1(0.2);
        setC2(0.5);
        setC3(0.8);
        setC4(0.95);
        setLabel1('A');
        setLabel2('B');
        setLabel3('C');
        setLabel4('D');
        setNumSimulations(1000);
        setDistributionType('uniform');

        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname);

        setCopyStatus('Reset!');
        setTimeout(() => setCopyStatus(''), 2000);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui', backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#f1f5f9' }}>AVLab - Approval Voting Strategy Analyzer</h1>

            <div style={{ marginBottom: '20px', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#f1f5f9' }}>Number of Candidates: {numCandidates}</span>
                    <button
                        onClick={removeCandidate}
                        disabled={numCandidates <= 2}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: numCandidates <= 2 ? '#475569' : '#ef4444',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            cursor: numCandidates <= 2 ? 'not-allowed' : 'pointer',
                            opacity: numCandidates <= 2 ? 0.5 : 1
                        }}
                    >
                        Remove Candidate
                    </button>
                    <button
                        onClick={addCandidate}
                        disabled={numCandidates >= 4}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: numCandidates >= 4 ? '#475569' : '#10b981',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            cursor: numCandidates >= 4 ? 'not-allowed' : 'pointer',
                            opacity: numCandidates >= 4 ? 0.5 : 1
                        }}
                    >
                        Add Candidate
                    </button>
                </div>
            </div>

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
                        max={numCandidates >= 3 ? Math.min(0.99, c3 - 0.01) : 0.99}
                        step="0.01"
                        value={c2}
                        onChange={e => setC2(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                {numCandidates >= 3 && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px', color: '#f1f5f9' }}>
                            C3 = {c3.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min={Math.max(0.01, c2 + 0.01)}
                            max={numCandidates >= 4 ? Math.min(0.99, c4 - 0.01) : 0.99}
                            step="0.01"
                            value={c3}
                            onChange={e => setC3(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                )}

                {numCandidates >= 4 && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px', color: '#f1f5f9' }}>
                            C4 = {c4.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min={Math.max(0.01, c3 + 0.01)}
                            max="0.99"
                            step="0.01"
                            value={c4}
                            onChange={e => setC4(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                )}
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px', color: '#f1f5f9' }}>Interval [0,1]</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>
                    <strong>Drag candidates</strong> to change positions. Indifference points shown in purple.
                </p>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '15px' }}>
                    Indifference points: {Object.entries(indifferencePoints).map(([key, val], idx) => (
                        <span key={key}>{idx > 0 ? ', ' : ''}{key.toUpperCase()}={val.toFixed(3)}</span>
                    ))}
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
                                        {formatRankingCompact(region.ranking)}
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
                    {Object.entries(indifferencePoints).map(([key, value]) => {
                        const label = key.toUpperCase();
                        return (
                            <g key={key}>
                                <line x1={value * 100 + '%'} y1="55" x2={value * 100 + '%'} y2="65" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2,2" />
                                <text x={value * 100 + '%'} y="50" fontSize="8" fill="#a78bfa" textAnchor="middle">{label}</text>
                            </g>
                        );
                    })}

                    {/* Candidates (draggable) */}
                    {Object.entries(candidates).map(([candId, position], idx) => {
                        const candKey = candId.toLowerCase();
                        return (
                            <g
                                key={candId}
                                onPointerDown={handlePointerDown(candKey)}
                                onTouchStart={handlePointerDown(candKey)}
                                style={{ cursor: 'grab', touchAction: 'none' }}
                            >
                                <circle cx={position * 100 + '%'} cy="100" r="8" fill={colors[idx]} stroke="#1e293b" strokeWidth="2" opacity="0.9" />
                                <text x={position * 100 + '%'} y="120" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#e2e8f0">{getLabel(candId)}</text>
                            </g>
                        );
                    })}

                    {/* Legend for ranking regions */}
                    <text x="0" y="145" fontSize="9" fill="#94a3b8">Voter Rankings by Location</text>
                </svg>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '20px' }}>
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



            <div style={{ backgroundColor: '#1e3a5f', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #3b82f6' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#93c5fd' }}>
                    Monte Carlo Simulation - Approval Voting
                </h3>
                <p style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px' }}>
                    Simulates approval voting where each voter bloc always approves their top choice,
                    never approves their last choice, and randomly decides whether to approve middle-ranked candidates.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Number of Simulations:
                        </label>
                        <input
                            type="number"
                            min="100"
                            max="10000"
                            step="100"
                            value={numSimulations}
                            onChange={(e) => setNumSimulations(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Probability Distribution:
                        </label>
                        <select
                            value={distributionType}
                            onChange={(e) => setDistributionType(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0', cursor: 'pointer' }}
                        >
                            <option value="uniform">Uniform (0 to 1)</option>
                            <option value="normal">Normal (mean=0.5, std=0.2)</option>
                        </select>
                    </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #1e40af' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#93c5fd' }}>
                        Winner Frequency (out of {numSimulations} simulations)
                    </h4>
                    {Object.entries(monteCarloResults)
                        .filter(([cand]) => candidates.hasOwnProperty(cand))
                        .sort((a, b) => b[1] - a[1])
                        .map(([cand, wins]) => {
                            const percentage = (wins / numSimulations) * 100;
                            const maxWins = Math.max(...Object.values(monteCarloResults));
                            const isWinner = wins === maxWins;

                            return (
                                <div key={cand} style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: isWinner ? 'bold' : 'normal', color: '#e2e8f0' }}>
                                            {getLabel(cand)}
                                            {isWinner && <span style={{ marginLeft: '6px' }}>🏆</span>}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: isWinner ? 'bold' : 'normal', color: '#cbd5e1' }}>
                                            {wins} ({percentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                        <div
                                            style={{
                                                width: percentage + '%',
                                                height: '100%',
                                                backgroundColor: isWinner ? '#3b82f6' : '#475569',
                                                transition: 'width 0.3s ease'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>
                    {distributionType === 'uniform'
                        ? 'Uniform distribution: Each voter bloc is assigned a random approval probability (0-100%) for middle-ranked candidates in each simulation. Last-ranked candidates are never approved.'
                        : 'Normal distribution: Blocs tend to approve ~50% for middle-ranked candidates, with variation (std=0.2). Example: a bloc might approve 80% of their 2nd choice in one sim, 30% in another. Last-ranked candidates are never approved.'}
                </p>
            </div>

            <div style={{ backgroundColor: '#134e4a', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #14b8a6' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#5eead4' }}>
                    Sincere Threshold Simulation
                </h3>
                <p style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px' }}>
                    Simulates {numVoters} voters uniformly distributed on [0,1]. Each voter approves candidates within their sincere threshold distance.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Number of Voters: {numVoters}
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="20000"
                            step="10"
                            value={numVoters}
                            onChange={(e) => setNumVoters(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Sincere Threshold: {sincereThreshold.toFixed(3)}
                        </label>
                        <input
                            type="range"
                            min="0.01"
                            max="1.0"
                            step="0.01"
                            value={sincereThreshold}
                            onChange={(e) => setSincereThreshold(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                        <input
                            type="checkbox"
                            checked={useBasicStrategy}
                            onChange={(e) => setUseBasicStrategy(e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Use basic strategy (always approve closest, never approve furthest)</span>
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Async Update Rate: {asyncUpdateRate.toFixed(1)} ({(asyncUpdateRate * (1 - sincereVoterProportion) * 100).toFixed(1)}% of all voters update per step)
                        </label>
                        <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={asyncUpdateRate}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setAsyncUpdateRate(v);
                                updateUrlParam('au', v.toFixed(1));
                            }}
                            style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                            Applies only to strategic voters. Lower values create gradual convergence.
                        </p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                            Sincere Voter Proportion: {sincereVoterProportion.toFixed(1)} ({(sincereVoterProportion * 100).toFixed(0)}% never change strategy)
                        </label>
                        <input
                            type="range"
                            min="0.0"
                            max="1.0"
                            step="0.1"
                            value={sincereVoterProportion}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setSincereVoterProportion(v);
                                updateUrlParam('sv', v.toFixed(1));
                            }}
                            style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                            These voters always vote with their initial sincere threshold.
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={redistributeVoters}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#0891b2',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Redistribute Voters
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>
                            Monte Carlo Sims: {sincereMCSimulations}
                        </label>
                    </div>
                    <button
                        onClick={runSincereMonteCarlo}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#0d9488',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Run Monte Carlo
                    </button>
                    <button
                        onClick={runTurnBasedSimulation}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            backgroundColor: '#7c3aed',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Run Turn-Based Simulation
                    </button>
                    {sincereMCResults && (
                        <button
                            onClick={() => setSincereMCResults(null)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                backgroundColor: '#475569',
                                border: 'none',
                                color: '#cbd5e1',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '13px'
                            }}
                        >
                            Clear Results
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #0d9488' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#5eead4' }}>
                            Approval Votes by Candidate
                        </h4>
                        {/* Show count of voters who cast no approvals, if any */}
                        {((sincereThresholdResults.votesDistribution && sincereThresholdResults.votesDistribution[0]) || 0) > 0 && (() => {
                            const noVotes = sincereThresholdResults.votesDistribution[0] || 0;
                            const percentage = (noVotes / sincereThresholdResults.totalVoters) * 100;
                            return (
                                <div key="no-vote" style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '14px', color: '#e2e8f0' }}>
                                            No Vote
                                        </span>
                                        <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                                            {noVotes} ({percentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                        <div
                                            style={{
                                                width: percentage + '%',
                                                height: '100%',
                                                backgroundColor: '#6b7280',
                                                transition: 'width 0.3s ease'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })()}

                        {Object.entries(sincereThresholdResults.approvalCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cand, votes]) => {
                                const percentage = (votes / sincereThresholdResults.totalVoters) * 100;
                                const isWinner = cand === sincereThresholdResults.winner;

                                return (
                                    <div key={cand} style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: isWinner ? 'bold' : 'normal', color: '#e2e8f0' }}>
                                                {getLabel(cand)}
                                                {isWinner && <span style={{ marginLeft: '6px' }}>🏆</span>}
                                            </span>
                                            <span style={{ fontSize: '13px', fontWeight: isWinner ? 'bold' : 'normal', color: '#cbd5e1' }}>
                                                {votes} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                            <div
                                                style={{
                                                    width: percentage + '%',
                                                    height: '100%',
                                                    backgroundColor: isWinner ? '#14b8a6' : '#475569',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}

                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                            {condorcetInfo.winner && condorcetInfo.winner !== 'None' ? (
                                <span>Condorcet winner: <strong style={{ color: '#60a5fa' }}>{getLabel(condorcetInfo.winner)}</strong></span>
                            ) : (
                                <span>No Condorcet winner</span>
                            )}
                        </div>
                    </div>

                    <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #0d9488' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#5eead4' }}>
                            Votes Cast per Voter
                        </h4>
                        {Object.entries(sincereThresholdResults.votesDistribution)
                            .filter(([count, voters]) => voters > 0)
                            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                            .map(([count, voters]) => {
                                const percentage = (voters / sincereThresholdResults.totalVoters) * 100;
                                const maxVoters = Math.max(...Object.values(sincereThresholdResults.votesDistribution));
                                const relativeWidth = (voters / maxVoters) * 100;

                                return (
                                    <div key={count} style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '14px', color: '#e2e8f0' }}>
                                                {count} {count === '1' ? 'candidate' : 'candidates'}
                                            </span>
                                            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                                                {voters} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                            <div
                                                style={{
                                                    width: relativeWidth + '%',
                                                    height: '100%',
                                                    backgroundColor: '#0d9488',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>
                    {useBasicStrategy
                        ? 'Basic strategy: Voters always approve their closest candidate and never approve their furthest candidate. Middle candidates are approved if within the threshold.'
                        : 'Without strategy: Voters approve all candidates within their sincere threshold. This could result in approving 0 or all candidates.'}
                </p>

                {sincereMCResults && (
                    <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #0d9488', marginTop: '15px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#5eead4' }}>
                            Monte Carlo Results ({sincereMCSimulations} simulations)
                        </h4>
                        {Object.entries(sincereMCResults)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cand, wins]) => {
                                const percentage = (wins / sincereMCSimulations) * 100;
                                const maxWins = Math.max(...Object.values(sincereMCResults));
                                const isWinner = wins === maxWins;

                                return (
                                    <div key={cand} style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: isWinner ? 'bold' : 'normal', color: '#e2e8f0' }}>
                                                {getLabel(cand)}
                                                {isWinner && <span style={{ marginLeft: '6px' }}>🏆</span>}
                                            </span>
                                            <span style={{ fontSize: '13px', fontWeight: isWinner ? 'bold' : 'normal', color: '#cbd5e1' }}>
                                                {wins} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                            <div
                                                style={{
                                                    width: percentage + '%',
                                                    height: '100%',
                                                    backgroundColor: isWinner ? '#14b8a6' : '#475569',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>
                            Each simulation randomly distributes {numVoters} voters across [0,1] and determines the winner.
                        </p>
                    </div>
                )}

                {turnBasedResults && (
                    <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #7c3aed', marginTop: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#c4b5fd' }}>
                                Turn-Based Simulation Results
                            </h4>
                            <button
                                onClick={() => setTurnBasedResults(null)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: '#475569',
                                    border: 'none',
                                    color: '#cbd5e1',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Clear
                            </button>
                        </div>

                        <div style={{ backgroundColor: '#1e1b4b', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', color: '#e9d5ff', marginBottom: '6px' }}>
                                <strong>Initial Winner:</strong> {getLabel(turnBasedResults[0].winner)} (Step 0)
                            </div>
                            <div style={{ fontSize: '13px', color: '#e9d5ff', marginBottom: '6px' }}>
                                <strong>Final Winner:</strong> {getLabel(turnBasedResults[turnBasedResults.length - 1].winner)} (Step {turnBasedResults.length - 1})
                            </div>
                            <div style={{ fontSize: '13px', color: '#e9d5ff', marginBottom: '6px' }}>
                                <strong>Viable Candidates (Step {currentStep}):</strong> {turnBasedResults[currentStep].viableCandidates.map(c => getLabel(c)).join(', ')}
                            </div>
                            <div style={{ fontSize: '13px', color: '#e9d5ff', marginBottom: '6px' }}>
                                <strong>Mean Ballot Size:</strong> {turnBasedResults[0].meanBallotSize.toFixed(2)} → {turnBasedResults[turnBasedResults.length - 1].meanBallotSize.toFixed(2)} candidates
                            </div>
                            <div style={{ fontSize: '13px', color: '#e9d5ff' }}>
                                <strong>Converged in {turnBasedResults.length - 1} steps</strong>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#cbd5e1' }}>
                                View Step: {currentStep} / {turnBasedResults.length - 1}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max={turnBasedResults.length - 1}
                                step="1"
                                value={currentStep}
                                onChange={(e) => setCurrentStep(parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                            <div>
                                <h5 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#c4b5fd' }}>
                                    Approval Votes by Candidate (Step {currentStep})
                                </h5>
                                {Object.entries(turnBasedResults[currentStep].approvalCounts)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([cand, votes]) => {
                                        const percentage = (votes / numVoters) * 100;
                                        const isWinner = cand === turnBasedResults[currentStep].winner;
                                        const isCondorcet = cand === condorcetInfo.winner && condorcetInfo.winner !== 'None';

                                        return (
                                            <div key={cand} style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: isWinner ? 'bold' : 'normal', color: '#e2e8f0' }}>
                                                        {getLabel(cand)}
                                                        {isWinner && <span style={{ marginLeft: '6px' }}>🏆</span>}
                                                        {isCondorcet && <span style={{ marginLeft: '4px', fontSize: '11px', color: '#60a5fa' }}>(Condorcet)</span>}
                                                    </span>
                                                    <span style={{ fontSize: '13px', fontWeight: isWinner ? 'bold' : 'normal', color: '#cbd5e1' }}>
                                                        {votes} ({percentage.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                    <div
                                                        style={{
                                                            width: percentage + '%',
                                                            height: '100%',
                                                            backgroundColor: isWinner ? '#7c3aed' : '#475569',
                                                            transition: 'width 0.3s ease'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            <div>
                                <h5 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#c4b5fd' }}>
                                    Votes Cast per Voter (Step {currentStep})
                                </h5>
                                {Object.entries(turnBasedResults[currentStep].votesDistribution)
                                    .filter(([count, voters]) => voters > 0)
                                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                                    .map(([count, voters]) => {
                                        const percentage = (voters / numVoters) * 100;
                                        const maxVoters = Math.max(...Object.values(turnBasedResults[currentStep].votesDistribution));
                                        const relativeWidth = (voters / maxVoters) * 100;

                                        return (
                                            <div key={count} style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '14px', color: '#e2e8f0' }}>
                                                        {count} {count === '1' ? 'candidate' : 'candidates'}
                                                    </span>
                                                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                                                        {voters} ({percentage.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '24px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                    <div
                                                        style={{
                                                            width: relativeWidth + '%',
                                                            height: '100%',
                                                            backgroundColor: '#7c3aed',
                                                            transition: 'width 0.3s ease'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        <div style={{ marginTop: '15px', backgroundColor: '#1e1b4b', padding: '12px', borderRadius: '4px' }}>
                            <h5 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#c4b5fd' }}>
                                Most Common Ballots (Step {currentStep})
                            </h5>
                            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                                {Object.entries(turnBasedResults[currentStep].ballotCounts)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 10)
                                    .map(([ballot, count]) => {
                                        const percentage = (count / numVoters) * 100;
                                        const candidateLabels = ballot.split(',').map(c => getLabel(c)).join(', ');
                                        return (
                                            <div key={ballot} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontFamily: 'monospace', color: '#e9d5ff' }}>
                                                    [{candidateLabels}]
                                                </span>
                                                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>
                                                    {count} voters ({percentage.toFixed(1)}%)
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                            <p style={{ fontSize: '10px', color: '#a78bfa', marginTop: '8px', fontStyle: 'italic' }}>
                                Ballots are ordered by each voter's preference (closest candidate first).
                            </p>

                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #4c1d95' }}>
                                <h6 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#c4b5fd' }}>
                                    Plurality Vote (if only first choice counted):
                                </h6>
                                {(() => {
                                    // Calculate plurality - count first candidate on each ballot
                                    const pluralityVotes = {};
                                    Object.entries(turnBasedResults[currentStep].ballotCounts).forEach(([ballot, count]) => {
                                        const firstChoice = ballot.split(',')[0]; // First candidate is voter's favorite
                                        pluralityVotes[firstChoice] = (pluralityVotes[firstChoice] || 0) + count;
                                    });

                                    const sorted = Object.entries(pluralityVotes).sort((a, b) => b[1] - a[1]);
                                    const pluralityWinner = sorted[0][0];

                                    return sorted.map(([cand, votes]) => {
                                        const percentage = (votes / numVoters) * 100;
                                        const isWinner = cand === pluralityWinner;
                                        return (
                                            <div key={cand} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '11px' }}>
                                                <span style={{ color: isWinner ? '#fbbf24' : '#cbd5e1', fontWeight: isWinner ? 'bold' : 'normal' }}>
                                                    {getLabel(cand)} {isWinner && '🥇'}
                                                </span>
                                                <span style={{ color: '#94a3b8' }}>
                                                    {votes} ({percentage.toFixed(1)}%)
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>
                            Each step, voters adjust strategically: viable candidates are within 3% of first place. Strategic voters never approve their least favorite candidate. If multiple are viable, voters approve their closest viable. If only one is viable (clear frontrunner), voters who have the frontrunner within their sincere threshold approve up to and including the frontrunner, while those who don't approve only candidates closer than the frontrunner. {(sincereVoterProportion * 100).toFixed(0)}% of voters are sincere and always vote with their initial threshold. Of the remaining {((1 - sincereVoterProportion) * 100).toFixed(0)}% strategic voters, {(asyncUpdateRate * 100).toFixed(0)}% update each step (= {(asyncUpdateRate * (1 - sincereVoterProportion) * 100).toFixed(1)}% of all voters).
                        </p>
                    </div>
                )}
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
                            placeholder="A"
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
                            placeholder="B"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                        />
                    </div>
                    {numCandidates >= 3 && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                                C3 Label:
                            </label>
                            <input
                                type="text"
                                value={label3}
                                onChange={(e) => setLabel3(e.target.value)}
                                placeholder="C"
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                            />
                        </div>
                    )}
                    {numCandidates >= 4 && (
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#cbd5e1' }}>
                                C4 Label:
                            </label>
                            <input
                                type="text"
                                value={label4}
                                onChange={(e) => setLabel4(e.target.value)}
                                placeholder="D"
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #475569', fontSize: '14px', backgroundColor: '#0f172a', color: '#e2e8f0' }}
                            />
                        </div>
                    )}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={copyUrlToClipboard} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#0891b2', border: 'none', color: '#e6fffa', fontWeight: '600', cursor: 'pointer' }}>
                        Copy URL
                    </button>
                    <button onClick={resetToDefaults} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#dc2626', border: 'none', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                        Reset to Defaults
                    </button>
                    <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{copyStatus}</span>
                </div>
            </div>
        </div>
    );
}

// Expose component to global scope so `index.html` can render it
window.VotingAnalysis = VotingAnalysis;