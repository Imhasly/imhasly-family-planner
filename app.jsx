/* The Imhasly Family Planner
   A simple kanban board for Orla, Eliza and Maya.
   Data persists to localStorage — no backend required. */

const { useState, useEffect, useRef, useMemo } = React;

const STORAGE_KEY = 'imhaslyFamilyPlanner.v1';

/* ───── Supabase sync (real-time, multi-device) ───── */

const SUPABASE_URL = 'https://fybjacvlmtvhahxtcgjv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5YmphY3ZsbXR2aGFoeHRjZ2p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTgyNzUsImV4cCI6MjA4OTkzNDI3NX0.JxjKIXx4hruFSeNdKnCtBNaI6b4m8dz6_CwzCn676jw';
const FAMILY_ID = 'imhasly';

const supabaseClient = (() => {
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) { console.error('Supabase init failed', e); }
  return null;
})();

async function syncLoad() {
  if (!supabaseClient) return { ok: false, reason: 'no-client' };
  try {
    const { data, error } = await supabaseClient
      .from('family_state')
      .select('data, updated_at')
      .eq('family_id', FAMILY_ID)
      .maybeSingle();
    if (error) return { ok: false, reason: error.code || error.message };
    return { ok: true, data: data?.data || null, updatedAt: data?.updated_at || null };
  } catch (e) {
    return { ok: false, reason: e.message || 'unknown' };
  }
}

async function syncSave(state) {
  if (!supabaseClient) return { ok: false };
  try {
    const { error } = await supabaseClient
      .from('family_state')
      .upsert({ family_id: FAMILY_ID, data: state, updated_at: new Date().toISOString() });
    if (error) return { ok: false, reason: error.code || error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message || 'unknown' };
  }
}

function syncSubscribe(onRemote) {
  if (!supabaseClient) return () => {};
  const channel = supabaseClient
    .channel('family_state:' + FAMILY_ID)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'family_state',
      filter: 'family_id=eq.' + FAMILY_ID,
    }, (payload) => {
      const next = payload.new && payload.new.data;
      if (next) onRemote(next);
    })
    .subscribe();
  return () => { try { supabaseClient.removeChannel(channel); } catch (e) {} };
}

function normalizeState(s) {
  if (!s || !Array.isArray(s.cards)) return null;
  return {
    ...s,
    cards: s.cards.map(c => ({ comments: [], photo: null, mins: 0, notes: '', ...c })),
    events: Array.isArray(s.events) ? s.events : [],
  };
}

const GIRLS = [
  { id: 'orla',  name: 'Orla',  age: 14, initial: 'O' },
  { id: 'eliza', name: 'Eliza', age: 12, initial: 'E' },
  { id: 'maya',  name: 'Maya',  age: 10, initial: 'M' },
];

const COLUMNS = [
  { id: 'todo',  title: 'To Do',  icon: '🌱', blurb: 'ideas & plans'     },
  { id: 'doing', title: 'Doing',  icon: '🚀', blurb: 'in progress'       },
  { id: 'done',  title: 'Done',   icon: '✨', blurb: 'ta-da!'            },
];

const TAGS = [
  { id: 'activity', label: 'Activity' },
  { id: 'home',     label: 'Home'     },
  { id: 'learning', label: 'Learning' },
  { id: 'fun',      label: 'Fun'      },
];

const AUTHORS = [
  { id: 'orla',  label: 'Orla'  },
  { id: 'eliza', label: 'Eliza' },
  { id: 'maya',  label: 'Maya'  },
  { id: 'mum',   label: 'Mum'   },
  { id: 'dad',   label: 'Dad'   },
];

const TIME_PRESETS = [
  { mins: 5,   label: '5m'       },
  { mins: 15,  label: '15m'      },
  { mins: 30,  label: '30m'      },
  { mins: 60,  label: '1h'       },
  { mins: 120, label: '2h'       },
  { mins: 240, label: 'half day' },
  { mins: 480, label: 'all day'  },
];

const EMOJIS = [
  '🎨','🎸','📚','⚽','🧁','🌳','🎮','🧩',
  '🎭','🏊','🔬','🌱','🎲','🚴','🍳','🐕',
  '✨','🎯','📖','🧺','🎤','🏕️','🎁','💫'
];

const GREETINGS = {
  orla:  ['Hi Orla',  'Hey Orla',  'Morning Orla',  'Hello Orla'],
  eliza: ['Hi Eliza', 'Hey Eliza', 'Morning Eliza', 'Hello Eliza'],
  maya:  ['Hi Maya',  'Hey Maya',  'Morning Maya',  'Hello Maya'],
  family:['Hey team', 'The whole crew', 'Everyone', 'The Imhaslys'],
};

/* ───── State helpers ───── */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cards)) {
        parsed.cards = parsed.cards.map(c => ({ comments: [], photo: null, mins: 0, notes: '', ...c }));
      }
      if (parsed && !Array.isArray(parsed.events)) parsed.events = [];
      return parsed;
    }
  } catch (e) {}
  return seedState();
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function seedState() {
  return {
    activeGirl: 'orla',
    events: [],
    cards: [
      // Orla — 14
      { id: uid(), girl: 'orla',  column: 'todo',  title: 'Sketchbook page — seascape',      tag: 'fun',      emoji: '🎨', mins: 30,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'orla',  column: 'todo',  title: 'Tidy bedroom & change sheets',     tag: 'home',     emoji: '🧺', mins: 15,  order: 1, comments: [], photo: null },
      { id: uid(), girl: 'orla',  column: 'doing', title: 'Marine Science revision block',   tag: 'learning', emoji: '🔬', mins: 60,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'orla',  column: 'done',  title: 'Walk the dog',                    tag: 'activity', emoji: '🐕', mins: 30,  order: 0, comments: [], photo: null },
      // Eliza — 12
      { id: uid(), girl: 'eliza', column: 'todo',  title: 'Finish guitar piece',             tag: 'fun',      emoji: '🎸', mins: 30,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'eliza', column: 'todo',  title: 'Bake something new',              tag: 'home',     emoji: '🧁', mins: 60,  order: 1, comments: [], photo: null },
      { id: uid(), girl: 'eliza', column: 'doing', title: 'Read next chapter',               tag: 'learning', emoji: '📖', mins: 30,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'eliza', column: 'done',  title: 'Swim session',                    tag: 'activity', emoji: '🏊', mins: 60,  order: 0, comments: [], photo: null },
      // Maya — 10
      { id: uid(), girl: 'maya',  column: 'todo',  title: 'Lego build — treehouse',          tag: 'fun',      emoji: '🧩', mins: 60,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'maya',  column: 'todo',  title: 'Feed the chickens',               tag: 'home',     emoji: '🌱', mins: 5,   order: 1, comments: [], photo: null },
      { id: uid(), girl: 'maya',  column: 'doing', title: 'Times tables practice',           tag: 'learning', emoji: '📚', mins: 15,  order: 0, comments: [], photo: null },
      { id: uid(), girl: 'maya',  column: 'done',  title: 'Bike ride with Dad',              tag: 'activity', emoji: '🚴', mins: 60,  order: 0, comments: [], photo: null },
    ],
  };
}

/* ───── Root ───── */

function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState('family'); // 'family' | 'orla' | 'eliza' | 'maya'
  const [openCardId, setOpenCardId] = useState(null);
  const [syncStatus, setSyncStatus] = useState(supabaseClient ? 'connecting' : 'local-only');

  // Refs used to break the save→remote→save loop.
  const lastSyncedJsonRef = useRef(null);
  const saveTimerRef = useRef(null);
  const bootstrappedRef = useRef(false);

  // Always persist to localStorage (fast + offline cache)
  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    document.body.className = 'theme-' + view;
  }, [view]);

  // Bootstrap: pull latest from Supabase; if empty, push local.
  useEffect(() => {
    if (!supabaseClient) return;
    (async () => {
      const res = await syncLoad();
      if (!res.ok) {
        setSyncStatus('offline');
        console.warn('Supabase load failed:', res.reason);
        bootstrappedRef.current = true;
        return;
      }
      const remote = normalizeState(res.data);
      if (remote) {
        lastSyncedJsonRef.current = JSON.stringify(remote);
        setState(remote);
      } else {
        // Row exists but no cards yet — push current local state up
        const push = await syncSave(state);
        if (push.ok) lastSyncedJsonRef.current = JSON.stringify(state);
      }
      setSyncStatus('connected');
      bootstrappedRef.current = true;
    })();
  }, []);

  // Debounced save to Supabase on any state change, skipping remote-sourced updates.
  useEffect(() => {
    if (!supabaseClient || !bootstrappedRef.current) return;
    const json = JSON.stringify(state);
    if (json === lastSyncedJsonRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const res = await syncSave(state);
      if (res.ok) {
        lastSyncedJsonRef.current = json;
        setSyncStatus('connected');
      } else {
        setSyncStatus('offline');
      }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state]);

  // Real-time subscription — apply remote changes locally, skipping our own echoes.
  useEffect(() => {
    if (!supabaseClient) return;
    const unsub = syncSubscribe((remote) => {
      const normalized = normalizeState(remote);
      if (!normalized) return;
      const json = JSON.stringify(normalized);
      if (json === lastSyncedJsonRef.current) return;
      lastSyncedJsonRef.current = json;
      setState(normalized);
    });
    return unsub;
  }, []);

  // Online / offline hints
  useEffect(() => {
    const onOnline  = () => { if (supabaseClient) setSyncStatus('connecting'); };
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    if (!navigator.onLine) setSyncStatus('offline');
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const cardsFor = (girlId) => state.cards.filter(c => c.girl === girlId);
  const openCard = state.cards.find(c => c.id === openCardId) || null;

  const pushEvent = (s, ev) => ({
    ...s,
    events: [{ id: uid(), at: Date.now(), ...ev }, ...(s.events || [])].slice(0, 100),
  });

  const addCard = (girlId, card) => {
    setState(s => {
      const cards = s.cards.filter(c => c.girl === girlId && c.column === 'todo');
      const maxOrder = cards.length ? Math.max(...cards.map(c => c.order)) : -1;
      const newCard = { id: uid(), girl: girlId, column: 'todo', order: maxOrder + 1, comments: [], photo: null, mins: 0, notes: '', ...card };
      return pushEvent(
        { ...s, cards: [...s.cards, newCard] },
        { girl: girlId, type: 'add', title: newCard.title, cardId: newCard.id }
      );
    });
  };

  const moveCard = (cardId, toColumn) => {
    setState(s => {
      const card = s.cards.find(c => c.id === cardId);
      if (!card) return s;
      const others = s.cards.filter(c => c.girl === card.girl && c.column === toColumn);
      const maxOrder = others.length ? Math.max(...others.map(c => c.order)) : -1;
      const next = {
        ...s,
        cards: s.cards.map(c =>
          c.id === cardId ? { ...c, column: toColumn, order: maxOrder + 1 } : c
        )
      };
      return pushEvent(next, { girl: card.girl, type: 'move', title: card.title, to: toColumn, cardId });
    });
  };

  const deleteCard = (cardId) => {
    setState(s => {
      const card = s.cards.find(c => c.id === cardId);
      const next = { ...s, cards: s.cards.filter(c => c.id !== cardId) };
      return card
        ? pushEvent(next, { girl: card.girl, type: 'delete', title: card.title })
        : next;
    });
  };

  const editCard = (cardId, patch) => {
    setState(s => {
      const card = s.cards.find(c => c.id === cardId);
      const next = {
        ...s,
        cards: s.cards.map(c => c.id === cardId ? { ...c, ...patch } : c)
      };
      if (!card) return next;
      // Log noteworthy edits only: photo added, title changed
      if ('photo' in patch && patch.photo && !card.photo) {
        return pushEvent(next, { girl: card.girl, type: 'photo', title: card.title, cardId });
      }
      if ('title' in patch && patch.title !== card.title) {
        return pushEvent(next, { girl: card.girl, type: 'edit', title: patch.title, oldTitle: card.title, cardId });
      }
      return next;
    });
  };

  const addComment = (cardId, text, by) => {
    const comment = { id: uid(), text, by, at: Date.now() };
    setState(s => {
      const card = s.cards.find(c => c.id === cardId);
      const next = {
        ...s,
        cards: s.cards.map(c =>
          c.id === cardId ? { ...c, comments: [...(c.comments || []), comment] } : c
        )
      };
      if (!card) return next;
      return pushEvent(next, { girl: card.girl, type: 'comment', title: card.title, by, cardId });
    });
  };

  const deleteComment = (cardId, commentId) => {
    setState(s => ({
      ...s,
      cards: s.cards.map(c =>
        c.id === cardId ? { ...c, comments: (c.comments || []).filter(x => x.id !== commentId) } : c
      )
    }));
  };

  const setPhoto = (cardId, dataUrl) => editCard(cardId, { photo: dataUrl });

  const exportBackup = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imhasly-family-planner-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.cards)) throw new Error('invalid');
      const ok = confirm('Import ' + parsed.cards.length + ' cards? This will replace the current board.');
      if (!ok) return;
      parsed.cards = parsed.cards.map(c => ({ comments: [], photo: null, mins: 0, notes: '', ...c }));
      setState(parsed);
    } catch (e) {
      alert('That does not look like a valid backup file.');
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">
            <span className="dot" />
            The Imhasly Family · kanban
            <SyncBadge status={syncStatus} />
          </div>
          <h1>The Imhasly <em>Family Planner</em></h1>
        </div>
        <nav className="girl-tabs" aria-label="Select girl">
          <button
            className={'girl-tab' + (view === 'family' ? ' active' : '')}
            onClick={() => setView('family')}
          >
            <span className="avatar family">✦</span>
            <span>Everyone</span>
          </button>
          {GIRLS.map(g => (
            <button
              key={g.id}
              className={'girl-tab' + (view === g.id ? ' active' : '')}
              onClick={() => setView(g.id)}
            >
              <span className={'avatar ' + g.id}>{g.initial}</span>
              <span>{g.name}</span>
              <span className="age">· {g.age}</span>
            </button>
          ))}
        </nav>
      </header>

      {view === 'family' ? (
        <FamilyOverview state={state} onPick={setView} />
      ) : (
        <GirlBoard
          girl={GIRLS.find(g => g.id === view)}
          cards={cardsFor(view)}
          events={state.events}
          onAdd={addCard}
          onMove={moveCard}
          onDelete={deleteCard}
          onOpen={setOpenCardId}
        />
      )}

      <div className="footer-note">
        <span>auto-saved to this browser · click a card to edit</span>
        <span className="footer-dot">·</span>
        <button className="footer-link" onClick={exportBackup} title="Download a JSON backup">
          export backup
        </button>
        <span className="footer-dot">·</span>
        <label className="footer-link" title="Restore from a JSON backup">
          import backup
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value=''; }}
          />
        </label>
      </div>

      {openCard && (
        <CardDrawer
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onEdit={editCard}
          onDelete={deleteCard}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          onSetPhoto={setPhoto}
        />
      )}
    </div>
  );
}

/* ───── Activity feed ───── */

function Activity({ events, girl, compact, limit }) {
  const max = limit || (compact ? 4 : 8);
  const filtered = (events || []).filter(e => !girl || e.girl === girl).slice(0, max);
  if (filtered.length === 0) {
    return (
      <div className="activity-empty">
        Nothing yet — cards, moves and comments will show up here.
      </div>
    );
  }
  return (
    <ul className="activity-list">
      {filtered.map(e => (
        <li key={e.id} className={'activity-item type-' + e.type}>
          <span className={'activity-avatar by-' + e.girl}>
            {GIRLS.find(g => g.id === e.girl)?.initial || '✦'}
          </span>
          <div className="activity-body">
            <div className="activity-text">
              {!girl && <strong>{GIRLS.find(g => g.id === e.girl)?.name} </strong>}
              {renderEventText(e)}
            </div>
            <div className="activity-time">{formatTime(e.at)}</div>
          </div>
          <span className="activity-icon">{iconForEvent(e)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderEventText(e) {
  switch (e.type) {
    case 'add':     return <>added <em>“{e.title}”</em></>;
    case 'move':
      if (e.to === 'done')   return <>completed <em>“{e.title}”</em></>;
      if (e.to === 'doing')  return <>started <em>“{e.title}”</em></>;
      return <>moved <em>“{e.title}”</em> back to to-do</>;
    case 'delete':  return <>removed <em>“{e.title}”</em></>;
    case 'edit':    return <>renamed a card to <em>“{e.title}”</em></>;
    case 'comment': return <><strong>{authorLabel(e.by)}</strong> commented on <em>“{e.title}”</em></>;
    case 'photo':   return <>added a photo to <em>“{e.title}”</em></>;
    default:        return e.title;
  }
}

function iconForEvent(e) {
  switch (e.type) {
    case 'add':     return '🌱';
    case 'move':    return e.to === 'done' ? '✨' : e.to === 'doing' ? '🚀' : '↩';
    case 'delete':  return '🗑';
    case 'edit':    return '✏';
    case 'comment': return '💬';
    case 'photo':   return '📷';
    default:        return '•';
  }
}

/* ───── Sync status badge ───── */

function SyncBadge({ status }) {
  const map = {
    'connecting': { cls: 'connecting', label: 'syncing…' },
    'connected':  { cls: 'connected',  label: 'in sync'  },
    'offline':    { cls: 'offline',    label: 'offline'  },
    'local-only': { cls: 'local',      label: 'local'    },
  };
  const v = map[status] || map['local-only'];
  return (
    <span className={'sync-badge ' + v.cls} title={'Live sync status: ' + v.label}>
      <span className="sync-dot" /> {v.label}
    </span>
  );
}

/* ───── Family overview ───── */

function FamilyOverview({ state, onPick }) {
  const totalPlanned = sumMins(state.cards.filter(c => c.column !== 'done'));
  return (
    <>
      <div className="hero">
        <div className="hero-avatar" style={{ background: '#b88bb6' }}>✦</div>
        <div className="hero-meta">
          <div className="greeting">{randomFrom(GREETINGS.family)} · {todayString()}</div>
          <h2>How's the week looking?</h2>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="n">{state.cards.filter(c => c.column === 'doing').length}</div>
            <div className="label">in progress</div>
          </div>
          <div className="hero-stat">
            <div className="n">{state.cards.filter(c => c.column === 'done').length}</div>
            <div className="label">done</div>
          </div>
          {totalPlanned > 0 && (
            <div className="hero-stat">
              <div className="n time">{formatMinutes(totalPlanned)}</div>
              <div className="label">planned</div>
            </div>
          )}
        </div>
      </div>

      <div className="family-grid">
        {GIRLS.map(g => {
          const cards = state.cards.filter(c => c.girl === g.id);
          const doing = cards.filter(c => c.column === 'doing');
          const todo = cards.filter(c => c.column === 'todo');
          const done = cards.filter(c => c.column === 'done');
          const planned = sumMins(cards.filter(c => c.column !== 'done'));
          return (
            <div key={g.id} className={'family-card ' + g.id} onClick={() => onPick(g.id)}>
              <div className="stripe" />
              <div className="family-card-body">
                <div className="family-card-head">
                  <div className="avatar">{g.initial}</div>
                  <div>
                    <div className="name">{g.name}</div>
                    <div className="age">{g.age} years</div>
                  </div>
                  {planned > 0 && (
                    <div className="family-time" title="Planned time">
                      <span className="clock">⏱</span> {formatMinutes(planned)}
                    </div>
                  )}
                </div>
                <div className="family-stats">
                  <div className="s"><div className="n">{todo.length}</div><div className="label">to do</div></div>
                  <div className="s"><div className="n">{doing.length}</div><div className="label">doing</div></div>
                  <div className="s"><div className="n">{done.length}</div><div className="label">done</div></div>
                </div>
                <div className="family-doing">
                  <div className="doing-label">Right now</div>
                  {doing.length === 0 ? (
                    <div className="none">nothing on the go</div>
                  ) : (
                    <ul>
                      {doing.slice(0, 3).map(c => (
                        <li key={c.id}>
                          {c.emoji && <span className="em">{c.emoji}</span>}
                          <span>{c.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="family-activity">
                  <div className="doing-label">Latest</div>
                  <Activity events={state.events} girl={g.id} compact limit={3} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="activity-card card">
        <div className="card-header">
          <h3 className="card-title">Everyone — recent activity</h3>
          <span className="card-sub">combined feed</span>
        </div>
        <Activity events={state.events} limit={10} />
      </section>
    </>
  );
}

/* ───── Girl board ───── */

function GirlBoard({ girl, cards, events, onAdd, onMove, onDelete, onOpen }) {
  const todoCount = cards.filter(c => c.column === 'todo').length;
  const doingCount = cards.filter(c => c.column === 'doing').length;
  const doneCount = cards.filter(c => c.column === 'done').length;
  const plannedMins = sumMins(cards.filter(c => c.column !== 'done'));

  return (
    <>
      <div className="hero">
        <div className="hero-avatar">{girl.initial}</div>
        <div className="hero-meta">
          <div className="greeting">{randomFrom(GREETINGS[girl.id])} · {todayString()}</div>
          <h2>What's the plan?</h2>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="n">{todoCount}</div>
            <div className="label">to do</div>
          </div>
          <div className="hero-stat">
            <div className="n">{doingCount}</div>
            <div className="label">doing</div>
          </div>
          <div className="hero-stat">
            <div className="n">{doneCount}</div>
            <div className="label">done</div>
          </div>
          {plannedMins > 0 && (
            <div className="hero-stat">
              <div className="n time">{formatMinutes(plannedMins)}</div>
              <div className="label">planned</div>
            </div>
          )}
        </div>
      </div>

      <div className="board">
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            column={col}
            girl={girl}
            cards={cards.filter(c => c.column === col.id).sort((a,b) => a.order - b.order)}
            onAdd={onAdd}
            onMove={onMove}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        ))}
      </div>

      <section className="activity-card card">
        <div className="card-header">
          <h3 className="card-title">{girl.name}'s recent activity</h3>
          <span className="card-sub">last updates</span>
        </div>
        <Activity events={events} girl={girl.id} />
      </section>
    </>
  );
}

/* ───── Column ───── */

function Column({ column, girl, cards, onAdd, onMove, onDelete, onOpen }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) onMove(cardId, column.id);
  };

  return (
    <div
      className={'column' + (dragOver ? ' drag-over' : '')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-head">
        <div className="title-wrap">
          <div className="col-icon">{column.icon}</div>
          <h3>{column.title}</h3>
        </div>
        <div className="count">{cards.length}</div>
      </div>

      <div className="card-list">
        {cards.length === 0 && column.id !== 'todo' && (
          <div className="empty">
            <div className="big">{column.icon}</div>
            <div>{column.blurb}</div>
          </div>
        )}
        {cards.map(card => (
          <KanbanCard
            key={card.id}
            card={card}
            onMove={onMove}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        ))}
      </div>

      {column.id === 'todo' && (
        <AddCard girl={girl} onAdd={onAdd} />
      )}
    </div>
  );
}

/* ───── Kanban card ───── */

function KanbanCard({ card, onMove, onDelete, onOpen }) {
  const [sparkle, setSparkle] = useState(false);
  const prevColumn = useRef(card.column);

  useEffect(() => {
    if (prevColumn.current !== card.column && card.column === 'done') {
      setSparkle(true);
      const t = setTimeout(() => setSparkle(false), 800);
      return () => clearTimeout(t);
    }
    prevColumn.current = card.column;
  }, [card.column]);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };
  const stop = (e) => e.stopPropagation();

  const moveLabels = {
    todo:  { prev: null,    next: 'doing' },
    doing: { prev: 'todo',   next: 'done'  },
    done:  { prev: 'doing',  next: null    },
  };
  const moves = moveLabels[card.column];
  const commentCount = (card.comments || []).length;

  return (
    <div
      className={'kcard' + (card.column === 'done' ? ' done' : '') + (sparkle ? ' sparkle' : '')}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onOpen(card.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(card.id); }}
    >
      <div className="kcard-top">
        {card.emoji && <div className="kcard-emoji">{card.emoji}</div>}
        <div className="kcard-title">{card.title}</div>
        <button className="kcard-close" onClick={e => { stop(e); onDelete(card.id); }} aria-label="Delete">×</button>
      </div>
      {card.photo && (
        <div className="kcard-photo"><img src={card.photo} alt="" /></div>
      )}
      <div className="kcard-bottom">
        <div className="kcard-chips">
          {card.tag && (
            <span className={'tag ' + card.tag}>{TAGS.find(t => t.id === card.tag)?.label}</span>
          )}
          {card.mins > 0 && (
            <span className="time-chip" title="Estimated time">⏱ {formatMinutes(card.mins)}</span>
          )}
          {card.notes && (
            <span className="notes-chip" title="Has notes">📝</span>
          )}
        </div>
        <div className="kcard-actions">
          {commentCount > 0 && (
            <span className="comment-badge" title={commentCount + ' comments'}>💬 {commentCount}</span>
          )}
          {moves.prev && (
            <button className="kcard-move" onClick={e => { stop(e); onMove(card.id, moves.prev); }} title="Move back" aria-label="Move back">‹</button>
          )}
          {moves.next && (
            <button className="kcard-move" onClick={e => { stop(e); onMove(card.id, moves.next); }} title="Move forward" aria-label="Move forward">›</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───── Add card ───── */

function AddCard({ girl, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [tag, setTag] = useState('');
  const [mins, setMins] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const commit = () => {
    const t = title.trim();
    if (!t) { reset(); return; }
    onAdd(girl.id, { title: t, emoji, tag, mins });
    reset();
  };
  const reset = () => {
    setTitle(''); setEmoji(''); setTag(''); setMins(0); setExpanded(false);
  };

  if (!expanded) {
    return (
      <div className="add-card">
        <button className="add-card-input" style={{ textAlign: 'left' }} onClick={() => setExpanded(true)}>
          + add a new card
        </button>
      </div>
    );
  }

  return (
    <div className="add-card">
      <div className="add-card-expanded">
        <input
          ref={inputRef}
          placeholder="What's the plan?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') reset();
          }}
        />
        <div className="emoji-row">
          {EMOJIS.map(em => (
            <button
              key={em}
              className={'emoji-pick' + (emoji === em ? ' selected' : '')}
              onClick={() => setEmoji(emoji === em ? '' : em)}
              type="button"
            >{em}</button>
          ))}
        </div>
        <div className="tag-row">
          {TAGS.map(t => (
            <button
              key={t.id}
              className={'tag-pick' + (tag === t.id ? ' selected' : '')}
              onClick={() => setTag(tag === t.id ? '' : t.id)}
              type="button"
            >{t.label}</button>
          ))}
        </div>
        <div className="pick-label">How long?</div>
        <div className="time-row">
          {TIME_PRESETS.map(t => (
            <button
              key={t.mins}
              className={'time-pick' + (mins === t.mins ? ' selected' : '')}
              onClick={() => setMins(mins === t.mins ? 0 : t.mins)}
              type="button"
            >{t.label}</button>
          ))}
        </div>
        <div className="add-card-buttons">
          <button className="btn ghost small" onClick={reset}>Cancel</button>
          <button className="btn primary small" onClick={commit}>Add card</button>
        </div>
      </div>
    </div>
  );
}

/* ───── Card drawer (edit / photo / comments) ───── */

function CardDrawer({ card, onClose, onEdit, onDelete, onAddComment, onDeleteComment, onSetPhoto }) {
  const [author, setAuthor] = useState(() => localStorage.getItem('imhaslyFamilyPlanner.author') || 'mum');
  const [newComment, setNewComment] = useState('');
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [notesDraft, setNotesDraft] = useState(card.notes || '');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => { localStorage.setItem('imhaslyFamilyPlanner.author', author); }, [author]);
  useEffect(() => { setTitleDraft(card.title); }, [card.id, card.title]);
  useEffect(() => { setNotesDraft(card.notes || ''); }, [card.id]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== card.title) onEdit(card.id, { title: t });
    else setTitleDraft(card.title);
  };
  const commitNotes = () => {
    if (notesDraft !== (card.notes || '')) onEdit(card.id, { notes: notesDraft });
  };
  const commitComment = () => {
    const t = newComment.trim();
    if (!t) return;
    onAddComment(card.id, t, author);
    setNewComment('');
  };
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      const url = await resizeImage(file);
      onSetPhoto(card.id, url);
    } catch (err) {
      setPhotoError('Could not load that image. Try a different one?');
    } finally {
      e.target.value = '';
    }
  };

  const comments = card.comments || [];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-head-left">
            {card.emoji && <span className="drawer-emoji">{card.emoji}</span>}
            <input
              className="drawer-title"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') { commitTitle(); e.target.blur(); } }}
              placeholder="Card title"
            />
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div className="section-label">Emoji</div>
            <div className="emoji-row">
              {EMOJIS.map(em => (
                <button
                  key={em}
                  className={'emoji-pick' + (card.emoji === em ? ' selected' : '')}
                  onClick={() => onEdit(card.id, { emoji: card.emoji === em ? '' : em })}
                  type="button"
                >{em}</button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="section-label">Tag</div>
            <div className="tag-row">
              {TAGS.map(t => (
                <button
                  key={t.id}
                  className={'tag-pick' + (card.tag === t.id ? ' selected' : '')}
                  onClick={() => onEdit(card.id, { tag: card.tag === t.id ? '' : t.id })}
                  type="button"
                >{t.label}</button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="section-label">Estimated time</div>
            <div className="time-row">
              {TIME_PRESETS.map(t => (
                <button
                  key={t.mins}
                  className={'time-pick' + (card.mins === t.mins ? ' selected' : '')}
                  onClick={() => onEdit(card.id, { mins: card.mins === t.mins ? 0 : t.mins })}
                  type="button"
                >{t.label}</button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="section-label">Notes</div>
            <textarea
              className="notes-area"
              placeholder="Add any details — steps, ideas, what you need…"
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              rows={3}
            />
          </div>

          <div className="drawer-section">
            <div className="section-label">Photo</div>
            {card.photo ? (
              <div className="photo-wrap">
                <img src={card.photo} alt="Attached" />
                <div className="photo-actions">
                  <label className="btn secondary small">
                    Replace
                    <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                  </label>
                  <button className="btn ghost small" onClick={() => onSetPhoto(card.id, null)}>Remove</button>
                </div>
              </div>
            ) : (
              <label className="photo-upload">
                <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                <div className="photo-upload-box">
                  <span className="photo-upload-icon">📷</span>
                  <span>Add a photo</span>
                </div>
              </label>
            )}
            {photoError && <div className="photo-error">{photoError}</div>}
          </div>

          <div className="drawer-section">
            <div className="section-label">Comments {comments.length > 0 && `(${comments.length})`}</div>
            <div className="comments-list">
              {comments.length === 0 && (
                <div className="comment-empty">No comments yet — say something nice ✨</div>
              )}
              {comments.map(c => (
                <div key={c.id} className="comment">
                  <div className={'comment-avatar by-' + c.by}>{authorLabel(c.by)[0]}</div>
                  <div className="comment-body">
                    <div className="comment-meta">
                      <strong>{authorLabel(c.by)}</strong>
                      <span className="comment-time">{formatTime(c.at)}</span>
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </div>
                  <button
                    className="comment-del"
                    onClick={() => onDeleteComment(card.id, c.id)}
                    aria-label="Delete comment"
                  >×</button>
                </div>
              ))}
            </div>
            <div className="comment-compose">
              <select value={author} onChange={e => setAuthor(e.target.value)} aria-label="Commenter">
                {AUTHORS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <input
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitComment(); }}
              />
              <button className="btn primary small" onClick={commitComment}>Post</button>
            </div>
          </div>

          <div className="drawer-footer">
            <button
              className="btn ghost small"
              onClick={() => { if (confirm('Delete this card?')) { onDelete(card.id); onClose(); } }}
            >Delete card</button>
            <button className="btn secondary small" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───── Utilities ───── */

function todayString() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function authorLabel(id) {
  return AUTHORS.find(a => a.id === id)?.label || id || '?';
}

function formatMinutes(m) {
  if (!m) return '';
  if (m === 480) return 'all day';
  if (m === 240) return 'half day';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h + 'h';
  return h + 'h ' + rem + 'm';
}

function sumMins(cards) {
  return cards.reduce((acc, c) => acc + (c.mins || 0), 0);
}

function formatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffMin < 1440) return Math.floor(diffMin / 60) + 'h ago';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function resizeImage(file, maxDim = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ───── Mount ───── */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
