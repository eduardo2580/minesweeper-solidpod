import { useState, useEffect, useRef, useCallback } from 'react';
import ToastContainer from './Toast.jsx';
import VaultAccessBanner from './VaultAccessBanner.jsx';
import Modal from './Modal.jsx';
import StatsModal from './StatsModal.jsx';
import { useToast } from '../hooks/useToast.js';
import { useVaultStorage } from '../hooks/useVaultStorage.js';
import * as solidOps from '../utils/solid.js';
import * as mockOps from '../utils/mockStorage.js';
import { translations } from '../utils/translations.js';
import { sounds } from '../utils/audio.js';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const ops = MOCK_MODE ? mockOps : solidOps;
const APP_NAMESPACE = import.meta.env.VITE_APP_NAMESPACE || 'com.privatedatapod.app';

// Difficulty presets
const difficulties = {
  easy: { rows: 8, cols: 8, mines: 10, multiplier: 1 },
  medium: { rows: 8, cols: 8, mines: 20, multiplier: 2 },
  hard: { rows: 8, cols: 8, mines: 35, multiplier: 3 },
};

const DEFAULT_STATS = {
  wins: 0,
  losses: 0,
  score: 0,
  highScore: 0,
  bestTimes: { easy: null, medium: null, hard: null },
  history: [],
};

export default function AppShell({ session, webId, onLogout }) {
  const { toasts, addToast, removeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [podUrl, setPodUrl] = useState(null);
  const [syncStatus, setSyncStatus] = useState(MOCK_MODE ? 'offline' : 'syncing');

  // Vault
  const vaultEnabled = !MOCK_MODE;
  const vault = useVaultStorage(podUrl, session.fetch, APP_NAMESPACE);
  const { needsApproval, open: openVault, lock: lockVault } = vault;

  // Language & UI State
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('minesweeper_lang') || 'en';
  });
  const t = translations[currentLang] || translations.en;

  const [isMuted, setIsMuted] = useState(() => sounds.isMuted());
  const [showInstructions, setShowInstructions] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Statistics State
  const [stats, setStats] = useState(() => {
    try {
      const local = localStorage.getItem('minesweeper_pod_stats');
      return local ? JSON.parse(local) : DEFAULT_STATS;
    } catch {
      return DEFAULT_STATS;
    }
  });

  // Game Engine State
  const [difficulty, setDifficulty] = useState('easy');
  const [board, setBoard] = useState([]);
  const [minesLeft, setMinesLeft] = useState(10);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'win', 'lose', or ''

  const timerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  // ── Profile & Pod Init ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const p = await ops.fetchProfile(webId, session.fetch);
        setProfile(p);
        setPodUrl(p.storageRoot);

        if (!MOCK_MODE && p.storageRoot) {
          // Ensure minesweeper/ container exists
          const folderUrl = `${p.storageRoot}minesweeper/`;
          try {
            const headRes = await session.fetch(folderUrl, { method: 'HEAD' });
            if (headRes.status === 404) {
              await ops.createFolder(folderUrl, session.fetch);
            }
          } catch {
            try {
              await ops.createFolder(folderUrl, session.fetch);
            } catch (err) {
              console.warn('Folder check notice:', err);
            }
          }

          // Fetch stats from Pod
          const statsUrl = `${folderUrl}stats.json`;
          try {
            const res = await session.fetch(statsUrl);
            if (res.ok) {
              const remoteStats = await res.json();
              if (remoteStats && typeof remoteStats.wins === 'number') {
                setStats(remoteStats);
                localStorage.setItem('minesweeper_pod_stats', JSON.stringify(remoteStats));
                setSyncStatus('synced');
              }
            } else if (res.status === 404) {
              // Write initial stats to Pod
              const blob = new Blob([JSON.stringify(DEFAULT_STATS, null, 2)], {
                type: 'application/json',
              });
              await ops.uploadFile(statsUrl, blob, session.fetch);
              setSyncStatus('synced');
            }
          } catch (err) {
            console.error('Failed reading Pod stats:', err);
            setSyncStatus('offline');
          }
        }
      } catch (err) {
        console.error('AppShell init error:', err);
        addToast('Could not load profile or connect to Pod.', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [webId, session, addToast]);

  // Open vault if enabled
  useEffect(() => {
    if (!vaultEnabled || !podUrl) return;
    openVault().catch(err => console.error('Vault open error:', err));
  }, [podUrl, vaultEnabled, openVault]);

  // ── Save Stats to Pod Helper ──────────────────────────────────────────────
  const saveStatsToPod = useCallback(
    async (newStats) => {
      setStats(newStats);
      localStorage.setItem('minesweeper_pod_stats', JSON.stringify(newStats));

      if (MOCK_MODE || !podUrl) {
        setSyncStatus('offline');
        return;
      }

      try {
        setSyncStatus('syncing');
        const statsUrl = `${podUrl}minesweeper/stats.json`;
        const blob = new Blob([JSON.stringify(newStats, null, 2)], {
          type: 'application/json',
        });
        await ops.uploadFile(statsUrl, blob, session.fetch);
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to sync stats to Pod:', err);
        setSyncStatus('offline');
        addToast('Failed to sync game record to Solid Pod.', 'error');
      }
    },
    [podUrl, session.fetch, addToast]
  );

  // ── Manual Sync Now ───────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    if (MOCK_MODE || !podUrl) {
      addToast('Mock Mode: Running on local storage.', 'info');
      return;
    }
    try {
      setSyncStatus('syncing');
      const statsUrl = `${podUrl}minesweeper/stats.json`;
      const res = await session.fetch(statsUrl);
      if (res.ok) {
        const remoteStats = await res.json();
        setStats(remoteStats);
        localStorage.setItem('minesweeper_pod_stats', JSON.stringify(remoteStats));
        setSyncStatus('synced');
        addToast('Synced latest stats from Solid Pod ☁️', 'success');
      } else {
        // Push local stats to Pod
        const blob = new Blob([JSON.stringify(stats, null, 2)], {
          type: 'application/json',
        });
        await ops.uploadFile(statsUrl, blob, session.fetch);
        setSyncStatus('synced');
        addToast('Uploaded stats to Solid Pod ☁️', 'success');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('offline');
      addToast('Sync failed. Please check your connection.', 'error');
    }
  };

  // ── Reset Data Confirmation ───────────────────────────────────────────────
  const handleResetConfirm = async () => {
    const blank = {
      wins: 0,
      losses: 0,
      score: 0,
      highScore: 0,
      bestTimes: { easy: null, medium: null, hard: null },
      history: [],
    };
    await saveStatsToPod(blank);
    setShowResetModal(false);
    setShowStatsModal(false);
    addToast('All game statistics have been reset.', 'info');
  };

  // ── Language Toggle ───────────────────────────────────────────────────────
  const handleLanguageChange = (lang) => {
    setCurrentLang(lang);
    localStorage.setItem('minesweeper_lang', lang);
  };

  // ── Sound Toggle ──────────────────────────────────────────────────────────
  const handleToggleMute = () => {
    const newMuted = sounds.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) sounds.playClick();
  };

  // ── Initialize Board ──────────────────────────────────────────────────────
  const initBoard = useCallback(
    (diff = difficulty) => {
      clearInterval(timerRef.current);
      const conf = difficulties[diff];
      const newGrid = [];

      for (let r = 0; r < conf.rows; r++) {
        const row = [];
        for (let c = 0; c < conf.cols; c++) {
          row.push({
            row: r,
            col: c,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            neighborMines: 0,
            exploded: false,
          });
        }
        newGrid.push(row);
      }

      setBoard(newGrid);
      setMinesLeft(conf.mines);
      setElapsedTime(0);
      setCurrentScore(0);
      setIsGameOver(false);
      setGameStarted(false);
      setFlagMode(false);
      setMessage(translations[currentLang]?.clickToStart || translations.en.clickToStart);
      setMessageType('');
    },
    [difficulty, currentLang]
  );

  useEffect(() => {
    initBoard();
    return () => clearInterval(timerRef.current);
  }, [initBoard]);

  // Update initial message when language changes if not started
  useEffect(() => {
    if (!gameStarted && !isGameOver) {
      setMessage(t.clickToStart);
    }
  }, [currentLang, gameStarted, isGameOver, t.clickToStart]);

  // ── Mine Placement (Safe First Click) ──────────────────────────────────────
  const populateMines = (grid, excludeRow, excludeCol, diff) => {
    const conf = difficulties[diff];
    const rows = conf.rows;
    const cols = conf.cols;
    let minesToPlace = conf.mines;

    // First, try to exclude the clicked cell AND its 8 neighbors for a generous first opening
    const excludedNeighbors = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = excludeRow + dr;
        const nc = excludeCol + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          excludedNeighbors.add(`${nr},${nc}`);
        }
      }
    }

    // If board is very crowded, only exclude clicked cell
    const canExcludeNeighbors = rows * cols - excludedNeighbors.size >= minesToPlace;
    const isExcluded = (r, c) =>
      canExcludeNeighbors ? excludedNeighbors.has(`${r},${c}`) : r === excludeRow && c === excludeCol;

    let placed = 0;
    while (placed < minesToPlace) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (!grid[r][c].isMine && !isExcluded(r, c)) {
        grid[r][c].isMine = true;
        placed++;
      }
    }

    // Compute neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                if (grid[nr][nc].isMine) count++;
              }
            }
          }
          grid[r][c].neighborMines = count;
        }
      }
    }
  };

  // ── Start Timer ───────────────────────────────────────────────────────────
  const startTimer = () => {
    clearInterval(timerRef.current);
    const startTimestamp = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimestamp) / 1000));
    }, 1000);
  };

  // ── Confetti Particle Celebration ─────────────────────────────────────────
  const triggerWinParticles = () => {
    for (let i = 0; i < 45; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.backgroundColor = `hsl(${Math.random() * 360}, 85%, 65%)`;
        p.style.animationDelay = Math.random() * 0.8 + 's';
        p.style.width = Math.random() * 8 + 8 + 'px';
        p.style.height = p.style.width;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 3200);
      }, i * 60);
    }
  };

  // ── Game Over (Win / Loss) ────────────────────────────────────────────────
  const handleGameOver = useCallback(
    (won, finalGrid, hitR, hitC) => {
      clearInterval(timerRef.current);
      setIsGameOver(true);

      const duration = elapsedTime;
      const conf = difficulties[difficulty];

      if (won) {
        sounds.playVictory();
        triggerWinParticles();
        setMessage(t.win);
        setMessageType('win');

        // Flag remaining mines
        finalGrid.forEach((row) => {
          row.forEach((cell) => {
            if (cell.isMine) cell.isFlagged = true;
          });
        });
        setMinesLeft(0);

        // Score formula: (mines * 10 + bonus) * multiplier
        const timeBonus = Math.max(0, 300 - duration);
        const gameScore = Math.floor((conf.mines * 10 + timeBonus) * conf.multiplier);
        setCurrentScore(gameScore);

        // Update stats
        const prevBest = stats.bestTimes?.[difficulty];
        const newBestTime = prevBest ? Math.min(prevBest, duration) : duration;

        const newStats = {
          ...stats,
          wins: (stats.wins || 0) + 1,
          score: (stats.score || 0) + gameScore,
          highScore: Math.max(stats.highScore || 0, gameScore),
          bestTimes: {
            ...stats.bestTimes,
            [difficulty]: newBestTime,
          },
          history: [
            {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              difficulty,
              won: true,
              time: duration,
              score: gameScore,
            },
            ...(stats.history || []),
          ].slice(0, 30),
        };

        saveStatsToPod(newStats);
      } else {
        sounds.playExplosion();
        setMessage(t.lose);
        setMessageType('lose');

        // Staggered reveal of all mines
        let mineDelay = 0;
        finalGrid.forEach((row) => {
          row.forEach((cell) => {
            if (cell.isMine) {
              if (cell.row === hitR && cell.col === hitC) {
                cell.exploded = true;
                cell.isRevealed = true;
              } else if (!cell.isFlagged) {
                setTimeout(() => {
                  cell.isRevealed = true;
                  setBoard([...boardRef.current]);
                }, mineDelay * 40);
                mineDelay++;
              }
            }
          });
        });

        // Record loss in stats
        const newStats = {
          ...stats,
          losses: (stats.losses || 0) + 1,
          history: [
            {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              difficulty,
              won: false,
              time: duration,
              score: 0,
            },
            ...(stats.history || []),
          ].slice(0, 30),
        };

        saveStatsToPod(newStats);
      }

      setBoard([...finalGrid]);
    },
    [difficulty, elapsedTime, saveStatsToPod, stats, t.lose, t.win]
  );

  // ── Win Check ─────────────────────────────────────────────────────────────
  const checkWinCondition = (grid) => {
    const conf = difficulties[difficulty];
    let revealedCount = 0;
    const totalSafeCells = conf.rows * conf.cols - conf.mines;

    for (let r = 0; r < conf.rows; r++) {
      for (let c = 0; c < conf.cols; c++) {
        if (!grid[r][c].isMine && grid[r][c].isRevealed) {
          revealedCount++;
        }
      }
    }
    return revealedCount === totalSafeCells;
  };

  // ── Reveal Cell (with BFS Flood-Fill) ──────────────────────────────────────
  const revealCell = (r, c, customGrid = null) => {
    const grid = customGrid || board.map((row) => row.map((cell) => ({ ...cell })));
    const target = grid[r][c];

    if (target.isRevealed || target.isFlagged) return;

    if (target.isMine) {
      handleGameOver(false, grid, r, c);
      return;
    }

    sounds.playClick();

    // BFS queue for revealing zeroes
    const queue = [[r, c]];
    target.isRevealed = true;

    while (queue.length > 0) {
      const [currR, currC] = queue.shift();
      const currCell = grid[currR][currC];

      if (currCell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (
              nr >= 0 &&
              nr < difficulties[difficulty].rows &&
              nc >= 0 &&
              nc < difficulties[difficulty].cols
            ) {
              const neighbor = grid[nr][nc];
              if (!neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine) {
                neighbor.isRevealed = true;
                if (neighbor.neighborMines === 0) {
                  queue.push([nr, nc]);
                }
              }
            }
          }
        }
      }
    }

    if (checkWinCondition(grid)) {
      handleGameOver(true, grid);
    } else {
      setBoard(grid);
    }
  };

  // ── Chording (Quick Clear for Revealed Numbers) ───────────────────────────
  const handleChord = (r, c) => {
    if (isGameOver) return;
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return;

    const rows = difficulties[difficulty].rows;
    const cols = difficulties[difficulty].cols;

    // Count adjacent flags
    let flagCount = 0;
    const unrevealedNeighbors = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = board[nr][nc];
          if (neighbor.isFlagged) flagCount++;
          else if (!neighbor.isRevealed) unrevealedNeighbors.push([nr, nc]);
        }
      }
    }

    if (flagCount === cell.neighborMines && unrevealedNeighbors.length > 0) {
      sounds.playChord();
      const grid = board.map((row) => row.map((c) => ({ ...c })));
      let hitMine = false;
      let hitR = -1;
      let hitC = -1;

      for (const [nr, nc] of unrevealedNeighbors) {
        const neighbor = grid[nr][nc];
        if (neighbor.isMine) {
          hitMine = true;
          hitR = nr;
          hitC = nc;
          break;
        }
        neighbor.isRevealed = true;
        if (neighbor.neighborMines === 0) {
          // Cascade zeroes from this cell
          const q = [[nr, nc]];
          while (q.length > 0) {
            const [qr, qc] = q.shift();
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nnr = qr + dr;
                const nnc = qc + dc;
                if (nnr >= 0 && nnr < rows && nnc >= 0 && nnc < cols) {
                  const target = grid[nnr][nnc];
                  if (!target.isRevealed && !target.isFlagged && !target.isMine) {
                    target.isRevealed = true;
                    if (target.neighborMines === 0) q.push([nnr, nnc]);
                  }
                }
              }
            }
          }
        }
      }

      if (hitMine) {
        handleGameOver(false, grid, hitR, hitC);
      } else if (checkWinCondition(grid)) {
        handleGameOver(true, grid);
      } else {
        setBoard(grid);
      }
    }
  };

  // ── Toggle Flag ───────────────────────────────────────────────────────────
  const toggleFlag = (r, c) => {
    if (isGameOver) return;
    const grid = board.map((row) => row.map((cell) => ({ ...cell })));
    const cell = grid[r][c];
    if (cell.isRevealed) return;

    if (cell.isFlagged) {
      cell.isFlagged = false;
      sounds.playFlag(false);
      setMinesLeft((prev) => prev + 1);
    } else {
      cell.isFlagged = true;
      sounds.playFlag(true);
      setMinesLeft((prev) => prev - 1);
    }
    setBoard(grid);
  };

  // ── Cell Click Handler ────────────────────────────────────────────────────
  const handleCellClick = (r, c) => {
    if (isGameOver) return;

    const cell = board[r][c];

    // Chording if clicking an already revealed number cell
    if (cell.isRevealed) {
      handleChord(r, c);
      return;
    }

    if (cell.isFlagged && !flagMode) return;

    // First click: generate safe board and start timer
    if (!gameStarted) {
      const freshGrid = board.map((row) => row.map((cell) => ({ ...cell })));
      populateMines(freshGrid, r, c, difficulty);
      setGameStarted(true);
      startTimer();
      setMessage('');

      if (flagMode) {
        toggleFlag(r, c);
      } else {
        revealCell(r, c, freshGrid);
      }
      return;
    }

    if (flagMode) {
      toggleFlag(r, c);
    } else {
      revealCell(r, c);
    }
  };

  // ── Right Click (Context Menu) ────────────────────────────────────────────
  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    if (isGameOver) return;
    toggleFlag(r, c);
  };

  // ── Mobile Touch Support (Long Press) ─────────────────────────────────────
  const handleTouchStart = (r, c) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      toggleFlag(r, c);
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
    }, 450);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);
  };

  // ── Change Difficulty ─────────────────────────────────────────────────────
  const handleDifficultyChange = (diff) => {
    setDifficulty(diff);
    initBoard(diff);
  };

  // ── New Game ──────────────────────────────────────────────────────────────
  const handleNewGame = () => {
    initBoard(difficulty);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner-lg" />
      </div>
    );
  }

  function handleLogout() {
    lockVault();
    onLogout();
  }

  return (
    <div className="app-shell">
      {MOCK_MODE && (
        <div className="mock-mode-banner">
          Mock mode — data stored in browser localStorage only
        </div>
      )}

      {vaultEnabled && needsApproval && <VaultAccessBanner podUrl={podUrl} />}

      {/* Bootstrap Navbar — collapses to burger on xs/sm screens */}
      <nav className="navbar navbar-expand-md app-navbar" aria-label="Main navigation">
        <div className="container-fluid px-3">

          {/* Brand / Title */}
          <a className="navbar-brand app-navbar-brand d-flex align-items-center gap-2" href="#">
            <span>💣</span>
            <span>Minesweeper</span>
            {/* Pod sync pill */}
            <span
              className={`pod-sync-pill ${syncStatus}`}
              title={
                syncStatus === 'synced'
                  ? t.podSynced
                  : syncStatus === 'syncing'
                  ? t.podSyncing
                  : t.podOffline
              }
            >
              ☁️ {syncStatus === 'synced' ? 'Pod' : syncStatus === 'syncing' ? '…' : 'Local'}
            </span>
          </a>

          {/* Burger toggle */}
          <button
            className="navbar-toggler border-0 app-navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#appNavMenu"
            aria-controls="appNavMenu"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Collapsible section */}
          <div className="collapse navbar-collapse" id="appNavMenu">
            {/* Language buttons — pushed to the right on md+ */}
            <ul className="navbar-nav ms-auto align-items-md-center gap-1 flex-row flex-wrap mt-2 mt-md-0">

              {/* Language selector */}
              <li className="nav-item d-flex gap-1">
                {['en', 'es', 'pt'].map((lang) => (
                  <button
                    key={lang}
                    className={`lang-btn${currentLang === lang ? ' active' : ''}`}
                    onClick={() => handleLanguageChange(lang)}
                    aria-pressed={currentLang === lang}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </li>

              {/* Divider (visible only md+) */}
              <li className="nav-item d-none d-md-block">
                <span className="app-nav-divider" aria-hidden="true" />
              </li>

              {/* User chip */}
              {profile?.name && (
                <li className="nav-item">
                  <div className="pod-user-chip" title={webId}>
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} className="pod-user-avatar" />
                    ) : (
                      <span className="pod-user-avatar">{profile.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="d-none d-sm-inline">{profile.name}</span>
                  </div>
                </li>
              )}

              {/* Sound toggle */}
              <li className="nav-item">
                <button
                  className="btn-icon"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? t.soundMuted : t.soundOn}
                  title={isMuted ? t.soundMuted : t.soundOn}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </li>

              {/* Stats */}
              <li className="nav-item">
                <button
                  className="btn-icon"
                  onClick={() => setShowStatsModal(true)}
                  aria-label={t.stats}
                  title={t.stats}
                >
                  📊
                </button>
              </li>

              {/* Sign out */}
              <li className="nav-item">
                <button className="btn-outline" onClick={handleLogout}>
                  {t.signOut}
                </button>
              </li>

            </ul>
          </div>
        </div>
      </nav>

      {/* Main Game Interface */}
      <main className="app-shell-main">
        <div className="game-container">
          <h2 className="game-title" id="title">
            {t.title}
          </h2>

          {/* Language Selector */}
          <div className="controls">
            <button
              className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              EN
            </button>
            <button
              className={`lang-btn ${currentLang === 'es' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('es')}
            >
              ES
            </button>
            <button
              className={`lang-btn ${currentLang === 'pt' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('pt')}
            >
              PT
            </button>
          </div>

          {/* Difficulty Selector */}
          <div className="difficulty-controls">
            <button
              className={`diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
              onClick={() => handleDifficultyChange('easy')}
              id="easyBtn"
            >
              🟢 {t.easy}
            </button>
            <button
              className={`diff-btn ${difficulty === 'medium' ? 'active' : ''}`}
              onClick={() => handleDifficultyChange('medium')}
              id="mediumBtn"
            >
              🟡 {t.medium}
            </button>
            <button
              className={`diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
              onClick={() => handleDifficultyChange('hard')}
              id="hardBtn"
            >
              🔴 {t.hard}
            </button>
          </div>

          {/* HUD Statistics */}
          <div className="stats">
            <div className="stat" title={t.title}>
              <div>💣</div>
              <div id="mines">{Math.max(0, minesLeft)}</div>
            </div>
            <div className="stat" title={t.time}>
              <div>⏱️</div>
              <div id="time">{elapsedTime}</div>
            </div>
            <div className="stat" title={t.score}>
              <div>🏆</div>
              <div id="score">{currentScore || stats.score || 0}</div>
            </div>
          </div>

          {/* Records Bar */}
          <div className="records">
            <div
              className="record"
              onClick={() => setShowStatsModal(true)}
              title="Click to view full statistics"
            >
              <div id="winLossLabel">📊 {t.winLoss}:</div>
              <div id="winLoss">
                {stats.wins || 0}/{stats.losses || 0}
              </div>
            </div>
          </div>

          {/* Game Buttons */}
          <div className="game-buttons">
            <button className="btn" id="newGameBtn" onClick={handleNewGame}>
              {t.newGame}
            </button>
            <button
              className={`btn ${flagMode ? 'flag-active' : ''}`}
              id="flagBtn"
              onClick={() => setFlagMode(!flagMode)}
            >
              {flagMode ? t.flagMode : t.flag}
            </button>
            <button
              className="btn"
              id="resetBtn"
              onClick={() => setShowResetModal(true)}
            >
              {t.resetConfirm}
            </button>
          </div>

          {/* Board Grid */}
          <div className="board-wrapper">
            <div
              className="board"
              id="board"
              style={{
                gridTemplateColumns: `repeat(${difficulties[difficulty].cols}, 1fr)`,
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  let cellClasses = 'cell';
                  let cellContent = '';

                  if (cell.isRevealed) {
                    cellClasses += ' revealed';
                    if (cell.isMine) {
                      cellClasses += ' mine';
                      cellContent = '💣';
                    } else if (cell.neighborMines > 0) {
                      cellClasses += ` n${cell.neighborMines} number-cell`;
                      cellContent = cell.neighborMines;
                    }
                  } else if (cell.isFlagged) {
                    cellClasses += ' flagged';
                    cellContent = '🚩';
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={cellClasses}
                      data-pos={`${r},${c}`}
                      onClick={() => handleCellClick(r, c)}
                      onContextMenu={(e) => handleContextMenu(e, r, c)}
                      onTouchStart={() => handleTouchStart(r, c)}
                      onTouchEnd={handleTouchEnd}
                    >
                      {cellContent}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Game Notification Message */}
          <div className={`message ${messageType}`} id="message">
            {message}
          </div>

          {/* Instructions Accordion */}
          <button
            className="instructions-toggle"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <span>📖 {t.instructionsTitle}</span>
            <span>{showInstructions ? '▲' : '▼'}</span>
          </button>

          {showInstructions && (
            <div
              className="instructions"
              id="instructions"
              dangerouslySetInnerHTML={{ __html: t.instructions }}
            />
          )}
        </div>
      </main>

      {/* Detailed Stats Modal */}
      <StatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        stats={stats}
        t={t}
        podUrl={podUrl}
        syncStatus={syncStatus}
        onSyncNow={handleSyncNow}
        onResetData={() => setShowResetModal(true)}
      />

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title={`⚠️ ${t.resetModalTitle}`}
        size="sm"
      >
        <div className="confirm-modal-body">
          <p>{t.resetModalDesc}</p>
          <div className="confirm-actions">
            <button className="btn-outline" onClick={() => setShowResetModal(false)}>
              {t.cancel}
            </button>
            <button className="btn-danger-outline" onClick={handleResetConfirm}>
              {t.resetButtonConfirm}
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
