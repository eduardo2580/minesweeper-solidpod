import Modal from './Modal.jsx';

export default function StatsModal({
  isOpen,
  onClose,
  stats,
  t,
  podUrl,
  syncStatus,
  onSyncNow,
  onResetData,
}) {
  if (!isOpen) return null;

  const totalGames = (stats.wins || 0) + (stats.losses || 0);
  const winRate = totalGames > 0 ? Math.round(((stats.wins || 0) / totalGames) * 100) : 0;

  const formatTime = (secs) => {
    if (!secs && secs !== 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`📊 ${t.stats}`} size="lg">
      <div className="stats-modal-content">
        {/* Pod Status Banner */}
        <div className="pod-status-card">
          <div className="pod-status-info">
            <span className="pod-icon">☁️</span>
            <div>
              <div className="pod-status-title">
                <strong>{t.podStatus}:</strong>{' '}
                <span className={`sync-badge ${syncStatus}`}>
                  {syncStatus === 'synced'
                    ? t.podSynced
                    : syncStatus === 'syncing'
                    ? t.podSyncing
                    : t.podOffline}
                </span>
              </div>
              {podUrl && (
                <div className="pod-path" title={`${podUrl}minesweeper/stats.json`}>
                  {podUrl}minesweeper/stats.json
                </div>
              )}
            </div>
          </div>
          {onSyncNow && (
            <button className="btn-sm btn-outline sync-btn" onClick={onSyncNow}>
              {t.syncNow}
            </button>
          )}
        </div>

        {/* Primary Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-val">{totalGames}</div>
            <div className="stat-card-lbl">{t.gamesPlayed}</div>
          </div>
          <div className="stat-card win">
            <div className="stat-card-val">{stats.wins || 0}</div>
            <div className="stat-card-lbl">{t.wins}</div>
          </div>
          <div className="stat-card lose">
            <div className="stat-card-val">{stats.losses || 0}</div>
            <div className="stat-card-lbl">{t.losses}</div>
          </div>
          <div className="stat-card rate">
            <div className="stat-card-val">{winRate}%</div>
            <div className="stat-card-lbl">{t.winRate}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{stats.highScore || 0}</div>
            <div className="stat-card-lbl">{t.highScore}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{stats.score || 0}</div>
            <div className="stat-card-lbl">{t.currentScore}</div>
          </div>
        </div>

        {/* Best Times Section */}
        <div className="section-block">
          <h3 className="section-title">⏱️ {t.bestTimes}</h3>
          <div className="best-times-row">
            <div className="best-time-pill easy">
              <span className="dot">🟢</span>
              <span className="name">{t.easy}</span>
              <span className="time">{formatTime(stats.bestTimes?.easy)}</span>
            </div>
            <div className="best-time-pill medium">
              <span className="dot">🟡</span>
              <span className="name">{t.medium}</span>
              <span className="time">{formatTime(stats.bestTimes?.medium)}</span>
            </div>
            <div className="best-time-pill hard">
              <span className="dot">🔴</span>
              <span className="name">{t.hard}</span>
              <span className="time">{formatTime(stats.bestTimes?.hard)}</span>
            </div>
          </div>
        </div>

        {/* Recent Game History */}
        <div className="section-block">
          <h3 className="section-title">📜 {t.recentHistory}</h3>
          {(!stats.history || stats.history.length === 0) ? (
            <p className="no-history-msg">{t.noHistory}</p>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.difficulty}</th>
                    <th>{t.result}</th>
                    <th>{t.time}</th>
                    <th>{t.score}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.history.slice(0, 10).map((game, idx) => (
                    <tr key={idx} className={game.won ? 'row-win' : 'row-lose'}>
                      <td>{formatDate(game.timestamp)}</td>
                      <td>
                        {game.difficulty === 'easy' && '🟢 ' + t.easy}
                        {game.difficulty === 'medium' && '🟡 ' + t.medium}
                        {game.difficulty === 'hard' && '🔴 ' + t.hard}
                      </td>
                      <td>
                        <span className={`result-tag ${game.won ? 'won' : 'lost'}`}>
                          {game.won ? '🏆 Win' : '💥 Loss'}
                        </span>
                      </td>
                      <td>{game.time}s</td>
                      <td>+{game.score || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="modal-actions-bar">
          <button className="btn-danger-outline" onClick={onResetData}>
            {t.resetConfirm}
          </button>
          <button className="btn-primary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
