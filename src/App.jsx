import React, { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, WORDS } from './words';

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;
const COLORS = ['#ef476f', '#ff9f1c', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f15bb5', '#00bbf9', '#00f5d4', '#f4a261'];

const createPlayer = (index, suffix = '') => ({
  id: `p-${index + 1}${suffix}`,
  name: `Player ${index + 1}`,
  color: COLORS[index % COLORS.length],
  score: 0,
});

const drawStroke = (ctx, points, color) => {
  if (!points?.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.stroke();
};

const getPoint = (event, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

export default function App() {
  const [players, setPlayers] = useState(() => Array.from({ length: MIN_PLAYERS }, (_, i) => createPlayer(i)));
  const idSuffix = useRef(100);
  const [moderatorId, setModeratorId] = useState(() => `p-1`);
  const [stage, setStage] = useState('lobby'); // lobby | moderator | cards | drawing | voting | results
  const [theme, setTheme] = useState(THEMES[0]);
  const [word, setWord] = useState(WORDS[THEMES[0]][0]);
  const [fakeId, setFakeId] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [revealIndex, setRevealIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);

  const canvasRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [turn, setTurn] = useState(0);
  const [undoUsed, setUndoUsed] = useState(false);

  const [votingMode, setVotingMode] = useState('public'); // public | private
  const [votes, setVotes] = useState({});
  const [voterIndex, setVoterIndex] = useState(0);
  const [voteReveal, setVoteReveal] = useState(false);
  const [tieCandidates, setTieCandidates] = useState([]);
  const [accusedId, setAccusedId] = useState(null);

  const [fakeGuess, setFakeGuess] = useState('');
  const [scored, setScored] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [round, setRound] = useState(1);

  const totalStrokes = players.length * 2;
  const currentPlayer = stage === 'drawing' && players.length ? players[turn % players.length] : null;
  const lineNumber = players.length ? Math.min(2, Math.floor(turn / players.length) + 1) : 1;
  const votesComplete = players.length > 0 && Object.keys(votes).length === players.length && Object.values(votes).every(Boolean);

  useEffect(() => {
    if (!players.length) return;
    if (!players.find((p) => p.id === moderatorId)) {
      setModeratorId(players[0].id);
    }
  }, [players, moderatorId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => drawStroke(ctx, stroke.points, stroke.color));
    if (isDrawing && currentStroke.length > 1 && currentPlayer) {
      drawStroke(ctx, currentStroke, currentPlayer.color);
    }
  }, [strokes, currentStroke, isDrawing, currentPlayer]);

  useEffect(() => {
    if (stage === 'drawing' && turn >= totalStrokes && totalStrokes > 0) {
      setStage('voting');
    }
  }, [stage, turn, totalStrokes]);

  const resetPerRoundState = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setIsDrawing(false);
    setTurn(0);
    setUndoUsed(false);
    setVotes({});
    setVoterIndex(0);
    setVoteReveal(false);
    setTieCandidates([]);
    setAccusedId(null);
    setFakeGuess('');
    setScored(false);
    setOutcome('');
  };

  const handlePlayerCountChange = (target) => {
    const nextCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, target));
    setPlayers((prev) => {
      const updated = [...prev];
      while (updated.length < nextCount) {
        const nextIndex = updated.length;
        idSuffix.current += 1;
        updated.push(createPlayer(nextIndex, `-${idSuffix.current}`));
      }
      while (updated.length > nextCount) {
        updated.pop();
      }
      return updated;
    });
  };

  const handlePlayerFieldChange = (id, key, value) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  };

  const randomizeModerator = () => {
    if (!players.length) return;
    const rand = players[Math.floor(Math.random() * players.length)];
    setModeratorId(rand.id);
  };

  const startModeratorScreen = () => {
    if (!moderatorId) {
      randomizeModerator();
    }
    resetPerRoundState();
    setWord((prev) => prev || WORDS[theme][0]);
    setStage('moderator');
  };

  const generateCards = () => {
    if (!word) return;
    resetPerRoundState();
    const fakePick = players[Math.floor(Math.random() * players.length)];
    setFakeId(fakePick.id);
    const assigned = players.reduce((acc, player) => {
      acc[player.id] = player.id === fakePick.id ? 'FAKE' : word;
      return acc;
    }, {});
    setAssignments(assigned);
    setRevealIndex(0);
    setCardRevealed(false);
    setStage('cards');
  };

  const beginDrawing = () => {
    resetPerRoundState();
    setStage('drawing');
  };

  const handlePointerDown = (e) => {
    if (stage !== 'drawing' || !currentPlayer || isDrawing || turn >= totalStrokes) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setCurrentStroke([getPoint(e, canvas)]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = getPoint(e, canvas);
    setCurrentStroke((prev) => [...prev, pt]);
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentPlayer) return;
    const strokePoints = currentStroke;
    setIsDrawing(false);
    setCurrentStroke([]);
    if (strokePoints.length < 2) return;
    const strokeEntry = {
      points: strokePoints,
      color: currentPlayer.color,
      playerId: currentPlayer.id,
      id: `${currentPlayer.id}-${turn}`,
    };
    setStrokes((prev) => [...prev, strokeEntry]);
    setTurn((prev) => {
      const next = prev + 1;
      if (next >= totalStrokes) {
        setStage('voting');
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (undoUsed || !strokes.length) return;
    setStrokes((prev) => prev.slice(0, -1));
    setTurn((prev) => Math.max(0, prev - 1));
    setUndoUsed(true);
    setStage('drawing');
  };

  const handleClear = () => {
    if (!window.confirm('Clear the canvas? This should rarely be used.')) return;
    resetPerRoundState();
    setStage('drawing');
  };

  const handleVoteSelect = (voterId, targetId) => {
    setVotes((prev) => ({ ...prev, [voterId]: targetId }));
  };

  const handlePrivateVote = (targetId) => {
    const voter = players[voterIndex];
    if (!voter) return;
    handleVoteSelect(voter.id, targetId);
    setVoterIndex((prev) => prev + 1);
  };

  const revealVotes = () => {
    const tally = players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
    Object.values(votes).forEach((voteFor) => {
      tally[voteFor] = (tally[voteFor] || 0) + 1;
    });
    const maxVotes = Math.max(...Object.values(tally));
    const leaders = Object.entries(tally)
      .filter(([, count]) => count === maxVotes)
      .map(([id]) => id);
    setVoteReveal(true);
    if (leaders.length === 1) {
      setAccusedId(leaders[0]);
      setTieCandidates([]);
    } else {
      setTieCandidates(leaders);
      setAccusedId(null);
    }
  };

  const applyScoring = (guessCorrect = false) => {
    if (scored || !fakeId || !moderatorId || !accusedId) return;
    const accusedIsFake = accusedId === fakeId;
    const updated = players.map((p) => {
      let delta = 0;
      if (accusedIsFake) {
        if (guessCorrect) {
          if (p.id === fakeId || p.id === moderatorId) delta += 2;
        } else if (p.id !== fakeId) {
          delta += 1;
        }
      } else {
        if (p.id === fakeId || p.id === moderatorId) delta += 2;
      }
      return { ...p, score: p.score + delta };
    });
    setPlayers(updated);
    if (accusedIsFake) {
      setOutcome(guessCorrect ? 'Fake guessed correctly: +2 to Fake & Moderator' : 'Artists caught the Fake: +1 to everyone else');
    } else {
      setOutcome('Group missed: +2 to Fake & Moderator');
    }
    setScored(true);
  };

  const handleGuessSubmit = () => {
    const correct = fakeGuess.trim().toLowerCase() === (word || '').trim().toLowerCase();
    applyScoring(correct);
  };

  const proceedToReveal = () => {
    setStage('results');
  };

  const resetForNextRound = (resetScores = false, goToLobby = false) => {
    setRound((r) => (resetScores ? 1 : r + 1));
    if (resetScores) {
      setPlayers((prev) => prev.map((p, idx) => ({ ...p, score: 0, name: p.name || `Player ${idx + 1}` })));
    }
    resetPerRoundState();
    setFakeId(null);
    setAssignments({});
    setRevealIndex(0);
    setCardRevealed(false);
    setStage(goToLobby ? 'lobby' : 'moderator');
    setWord(WORDS[theme][0]);
  };

  const accusedPlayer = useMemo(() => players.find((p) => p.id === accusedId), [players, accusedId]);
  const fakePlayer = useMemo(() => players.find((p) => p.id === fakeId), [players, fakeId]);
  const moderator = useMemo(() => players.find((p) => p.id === moderatorId), [players, moderatorId]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Party Game</p>
          <h1>Fake Artist</h1>
          <p className="subtitle">One device, bold strokes, dramatic accusations.</p>
        </div>
        <div className="status-block">
          <div>Round {round}</div>
          <div className="tiny-label">Moderator</div>
          <div className="moderator-name" style={{ color: moderator?.color || '#fff' }}>
            {moderator?.name || 'Pick one'}
          </div>
        </div>
      </header>

      <section className="content">
        {stage === 'lobby' && (
          <Lobby
            players={players}
            moderatorId={moderatorId}
            onModeratorChange={setModeratorId}
            randomizeModerator={randomizeModerator}
            onPlayerCountChange={handlePlayerCountChange}
            onPlayerFieldChange={handlePlayerFieldChange}
            onStart={startModeratorScreen}
          />
        )}

        {stage === 'moderator' && (
          <ModeratorScreen
            theme={theme}
            word={word}
            themes={THEMES}
            wordsByTheme={WORDS}
            moderator={moderator}
            onThemeChange={(t) => {
              setTheme(t);
              setWord(WORDS[t][0]);
            }}
            onWordChange={setWord}
            onRandomWord={() => {
              const options = WORDS[theme];
              const choice = options[Math.floor(Math.random() * options.length)];
              setWord(choice);
            }}
            onGenerate={generateCards}
            onBack={() => setStage('lobby')}
          />
        )}

        {stage === 'cards' && (
          <CardReveal
            players={players}
            assignments={assignments}
            revealIndex={revealIndex}
            cardRevealed={cardRevealed}
            onReveal={() => setCardRevealed(true)}
            onHide={() => setCardRevealed(false)}
            onNext={() => {
              setCardRevealed(false);
              setRevealIndex((i) => i + 1);
            }}
            onBegin={beginDrawing}
          />
        )}

        {stage === 'drawing' && (
          <DrawingScreen
            theme={theme}
            word={word}
            round={round}
            currentPlayer={currentPlayer}
            lineNumber={lineNumber}
            turn={turn}
            totalStrokes={totalStrokes}
            strokes={strokes}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            canvasRef={canvasRef}
            onUndo={handleUndo}
            onClear={handleClear}
            undoUsed={undoUsed}
            moderator={moderator}
            players={players}
            onSkipToVote={() => setStage('voting')}
          />
        )}

        {stage === 'voting' && (
          <VotingScreen
            players={players}
            votes={votes}
            votingMode={votingMode}
            voterIndex={voterIndex}
            voteReveal={voteReveal}
            tieCandidates={tieCandidates}
            accusedId={accusedId}
            onModeToggle={() => setVotingMode((m) => (m === 'public' ? 'private' : 'public'))}
            onPublicVote={handleVoteSelect}
            onPrivateVote={handlePrivateVote}
            onRevealVotes={revealVotes}
            onAccuse={setAccusedId}
            onResolve={proceedToReveal}
            onBackToDraw={() => {
              setStage('drawing');
              setVoteReveal(false);
              setVotes({});
              setAccusedId(null);
              setTieCandidates([]);
              setVoterIndex(0);
            }}
            votesComplete={votesComplete}
          />
        )}

        {stage === 'results' && (
          <ResultScreen
            players={players}
            moderator={moderator}
            fakePlayer={fakePlayer}
            accusedPlayer={accusedPlayer}
            word={word}
            fakeGuess={fakeGuess}
            onGuessChange={setFakeGuess}
            onGuessSubmit={handleGuessSubmit}
            accusedIsFake={accusedId === fakeId}
            scored={scored}
            applyAutoScore={() => applyScoring(false)}
            outcome={outcome}
            onNextRound={() => resetForNextRound(false, false)}
            onChangeModerator={() => resetForNextRound(false, true)}
            onResetGame={() => resetForNextRound(true, true)}
          />
        )}
      </section>

      <ScoreTable players={players} />
    </div>
  );
}

function Lobby({
  players,
  moderatorId,
  onModeratorChange,
  randomizeModerator,
  onPlayerCountChange,
  onPlayerFieldChange,
  onStart,
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Lobby</h2>
          <p className="muted">Set names, pick a moderator, and jump in.</p>
        </div>
        <div className="inline-controls">
          <span className="tiny-label">Players</span>
          <div className="pill">
            <button onClick={() => onPlayerCountChange(players.length - 1)} disabled={players.length <= MIN_PLAYERS}>
              –
            </button>
            <input
              type="number"
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              value={players.length}
              onChange={(e) => onPlayerCountChange(Number(e.target.value))}
            />
            <button onClick={() => onPlayerCountChange(players.length + 1)} disabled={players.length >= MAX_PLAYERS}>
              +
            </button>
          </div>
        </div>
      </div>

      <div className="players-grid">
        {players.map((player, index) => (
          <div className="player-card" key={player.id}>
            <div className="tiny-label">Player {index + 1}</div>
            <input
              className="text-input"
              value={player.name}
              onChange={(e) => onPlayerFieldChange(player.id, 'name', e.target.value)}
            />
            <label className="color-picker">
              <span className="tiny-label">Color</span>
              <input
                type="color"
                value={player.color}
                onChange={(e) => onPlayerFieldChange(player.id, 'color', e.target.value)}
              />
            </label>
            <label className="radio">
              <input
                type="radio"
                name="moderator"
                checked={moderatorId === player.id}
                onChange={() => onModeratorChange(player.id)}
              />
              <span>Moderator</span>
            </label>
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="ghost" onClick={randomizeModerator}>
          Random Moderator
        </button>
        <button className="primary" onClick={onStart}>
          Start Round
        </button>
      </div>
    </div>
  );
}

function ModeratorScreen({ theme, word, themes, wordsByTheme, moderator, onThemeChange, onWordChange, onRandomWord, onGenerate, onBack }) {
  const themeWords = wordsByTheme[theme] || [];
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>You are the Moderator</h2>
          <p className="muted">Pick a theme and word, then generate cards.</p>
        </div>
        <div className="badge" style={{ background: moderator?.color || '#1f2937' }}>
          {moderator?.name || 'Unknown'}
        </div>
      </div>
      <div className="form-grid">
        <label>
          <span className="tiny-label">Theme</span>
          <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
            {themes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="tiny-label">Word</span>
          <select value={word} onChange={(e) => onWordChange(e.target.value)}>
            {themeWords.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <button className="ghost full" onClick={onRandomWord}>
          Random Word
        </button>
      </div>
      <div className="actions">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <button className="primary" onClick={onGenerate}>
          Generate Cards
        </button>
      </div>
      <p className="muted">Pass the device to each player to reveal their card.</p>
    </div>
  );
}

function CardReveal({ players, assignments, revealIndex, cardRevealed, onReveal, onHide, onNext, onBegin }) {
  const currentPlayer = players[revealIndex];
  const allDone = revealIndex >= players.length;
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Secret Cards</h2>
        <p className="muted">One at a time. No peeking.</p>
      </div>
      {!allDone && currentPlayer ? (
        <div className="reveal-card">
          <div className="tiny-label">Player</div>
          <h3 style={{ color: currentPlayer.color }}>{currentPlayer.name}</h3>
          {!cardRevealed ? (
            <button className="primary" onClick={onReveal}>
              Tap to reveal
            </button>
          ) : (
            <div className="card-face">
              {assignments[currentPlayer.id] === 'FAKE' ? (
                <div className="fake-callout">YOU ARE THE FAKE ARTIST</div>
              ) : (
                <div>
                  <div className="tiny-label">Your word</div>
                  <div className="word">{assignments[currentPlayer.id]}</div>
                </div>
              )}
            </div>
          )}
          <div className="actions">
            <button className="ghost" onClick={onHide} disabled={!cardRevealed}>
              Hide card
            </button>
            <button className="primary" onClick={onNext} disabled={!cardRevealed}>
              Next player
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button className="primary" onClick={onBegin}>
            Begin Drawing Round
          </button>
        </div>
      )}
      <p className="muted">Progress: {Math.min(revealIndex, players.length)} / {players.length}</p>
    </div>
  );
}

function DrawingScreen({
  theme,
  word,
  round,
  currentPlayer,
  lineNumber,
  turn,
  totalStrokes,
  strokes,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  canvasRef,
  onUndo,
  onClear,
  undoUsed,
  moderator,
  players,
  onSkipToVote,
}) {
  const remaining = Math.max(0, totalStrokes - turn);
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="tiny-label">Theme</p>
          <h2>{theme}</h2>
          <p className="muted">Round {round}</p>
        </div>
        <div className="turn-banner">
          {currentPlayer ? (
            <>
              <span className="dot" style={{ background: currentPlayer.color }} />
              <div>
                Turn: {currentPlayer.name} — Line {lineNumber} of 2
                <p className="muted tiny">Stroke {turn + 1} / {totalStrokes}</p>
              </div>
            </>
          ) : (
            <div>All strokes placed</div>
          )}
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={960}
          height={600}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        <div className="canvas-overlay">
          <div className="hint">One continuous stroke per turn. Use your color.</div>
        </div>
      </div>
      <div className="actions">
        <button className="ghost" onClick={onUndo} disabled={undoUsed || !strokes.length}>
          Undo last stroke (mod only)
        </button>
        <button className="ghost" onClick={onClear}>
          Clear canvas (mod only)
        </button>
        <button className="primary" onClick={onSkipToVote} disabled={remaining > 0}>
          Go to Voting
        </button>
      </div>
      <div className="muted">
        Players: {players.map((p) => (
          <span key={p.id} className="inline-chip">
            <span className="dot" style={{ background: p.color }} /> {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function VotingScreen({
  players,
  votes,
  votingMode,
  voterIndex,
  voteReveal,
  tieCandidates,
  accusedId,
  onModeToggle,
  onPublicVote,
  onPrivateVote,
  onRevealVotes,
  onAccuse,
  onResolve,
  onBackToDraw,
  votesComplete,
}) {
  const tally = players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
  Object.values(votes).forEach((target) => {
    tally[target] = (tally[target] || 0) + 1;
  });
  const currentVoter = players[voterIndex];
  const tiesExist = tieCandidates.length > 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Voting</h2>
          <p className="muted">Pick who you think is the Fake Artist.</p>
        </div>
        <button className="ghost" onClick={onModeToggle}>
          {votingMode === 'public' ? 'Switch to Private voting' : 'Switch to Public voting'}
        </button>
      </div>

      {votingMode === 'public' ? (
        <div className="public-vote">
          {players.map((voter) => (
            <div key={voter.id} className="vote-row">
              <div className="inline-chip">
                <span className="dot" style={{ background: voter.color }} /> {voter.name}
              </div>
              <select value={votes[voter.id] || ''} onChange={(e) => onPublicVote(voter.id, e.target.value)}>
                <option value="">Select accused</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="private-vote">
          {currentVoter ? (
            <>
              <div className="private-card">
                <p className="tiny-label">Current voter</p>
                <h3 style={{ color: currentVoter.color }}>{currentVoter.name}</h3>
                <div className="vote-grid">
                  {players.map((p) => (
                    <button key={p.id} className="ghost" onClick={() => onPrivateVote(p.id)}>
                      <span className="dot" style={{ background: p.color }} /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="muted">Pass the device after picking.</p>
            </>
          ) : (
            <p className="muted">All votes collected.</p>
          )}
        </div>
      )}

      <div className="actions">
        <button className="ghost" onClick={onBackToDraw}>
          Back to Drawing
        </button>
        <button className="primary" disabled={!votesComplete} onClick={onRevealVotes}>
          Reveal votes
        </button>
      </div>

      {voteReveal && (
        <div className="reveal-box">
          <div className="countdown">1…2…3… POINT!</div>
          <div className="vote-results">
            {players.map((p) => (
              <div key={p.id} className={`vote-result ${accusedId === p.id ? 'accused' : ''}`}>
                <span className="dot" style={{ background: p.color }} /> {p.name} — {tally[p.id] || 0} vote(s)
              </div>
            ))}
          </div>
          {tiesExist && (
            <div className="tie-break">
              <p className="muted">Tie! Moderator chooses.</p>
              <div className="vote-grid">
                {tieCandidates.map((id) => {
                  const player = players.find((p) => p.id === id);
                  if (!player) return null;
                  return (
                    <button key={id} className="ghost" onClick={() => onAccuse(id)}>
                      <span className="dot" style={{ background: player.color }} /> {player.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {accusedId && (
            <div className="actions">
              <button className="primary" onClick={onResolve}>
                Reveal Fake Artist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultScreen({
  players,
  moderator,
  fakePlayer,
  accusedPlayer,
  word,
  fakeGuess,
  onGuessChange,
  onGuessSubmit,
  accusedIsFake,
  scored,
  applyAutoScore,
  outcome,
  onNextRound,
  onChangeModerator,
  onResetGame,
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Reveal</h2>
          <p className="muted">Who was the Fake Artist?</p>
        </div>
      </div>
      <div className="summary">
        <div className="badge-row">
          <span className="tiny-label">Fake Artist</span>
          <div className="badge" style={{ background: fakePlayer?.color || '#1f2937' }}>
            {fakePlayer?.name || 'Unknown'}
          </div>
        </div>
        <div className="badge-row">
          <span className="tiny-label">Accused</span>
          <div className="badge" style={{ background: accusedPlayer?.color || '#1f2937' }}>
            {accusedPlayer?.name || 'None'}
          </div>
        </div>
        <div className="badge-row">
          <span className="tiny-label">Secret word</span>
          <div className="badge solid">{word}</div>
        </div>
      </div>

      {accusedIsFake ? (
        <div className="fake-guess">
          <p className="muted">Accusation correct! Fake Artist gets one guess.</p>
          <div className="guess-row">
            <input
              className="text-input"
              placeholder="Fake artist: guess the word"
              value={fakeGuess}
              onChange={(e) => onGuessChange(e.target.value)}
            />
            <button className="primary" onClick={onGuessSubmit} disabled={!fakeGuess.trim() || scored}>
              Submit guess
            </button>
          </div>
        </div>
      ) : (
        <div className="fake-guess">
          <p className="muted">Group missed! Fake Artist and Moderator earn +2.</p>
          <button className="primary" onClick={applyAutoScore} disabled={scored}>
            Apply scoring
          </button>
        </div>
      )}

      {outcome && <div className="outcome">{outcome}</div>}

      <div className="actions">
        <button className="ghost" onClick={onChangeModerator}>
          Change Moderator
        </button>
        <button className="primary" onClick={onNextRound}>
          Next Round
        </button>
        <button className="ghost" onClick={onResetGame}>
          New Game (reset scores)
        </button>
      </div>
      <div className="muted">Scoring: Correct guess = +2 to Fake & Moderator. Wrong guess = +1 to everyone else.</div>
    </div>
  );
}

function ScoreTable({ players }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="panel scoreboard">
      <h3>Scoreboard</h3>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="dot" style={{ background: p.color }} /> {p.name}
              </td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
