/* The Imhasly Family Planner
   A simple kanban board for Orla, Eliza and Maya.
   Data persists to localStorage — no backend required. */

const { useState, useEffect, useRef, useMemo } = React;

const STORAGE_KEY = 'imhaslyFamilyPlanner.v1';

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
    if (raw) return JSON.parse(raw);
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
    cards: [
      // Orla — 14
      { id: uid(), girl: 'orla',  column: 'todo',  title: 'Sketchbook page — seascape',      tag: 'fun',      emoji: '🎨', order: 0 },
      { id: uid(), girl: 'orla',  column: 'todo',  title: 'Tidy bedroom & change sheets',     tag: 'home',     emoji: '🧺', order: 1 },
      { id: uid(), girl: 'orla',  column: 'doing', title: 'Marine Science revision block',   tag: 'learning', emoji: '🔬', order: 0 },
      { id: uid(), girl: 'orla',  column: 'done',  title: 'Walk the dog',                    tag: 'activity', emoji: '🐕', order: 0 },
      // Eliza — 12
      { id: uid(), girl: 'eliza', column: 'todo',  title: 'Finish guitar piece',             tag: 'fun',      emoji: '🎸', order: 0 },
      { id: uid(), girl: 'eliza', column: 'todo',  title: 'Bake something new',              tag: 'home',     emoji: '🧁', order: 1 },
      { id: uid(), girl: 'eliza', column: 'doing', title: 'Read next chapter',               tag: 'learning', emoji: '📖', order: 0 },
      { id: uid(), girl: 'eliza', column: 'done',  title: 'Swim session',                    tag: 'activity', emoji: '🏊', order: 0 },
      // Maya — 10
      { id: uid(), girl: 'maya',  column: 'todo',  title: 'Lego build — treehouse',          tag: 'fun',      emoji: '🧩', order: 0 },
      { id: uid(), girl: 'maya',  column: 'todo',  title: 'Feed the chickens',               tag: 'home',     emoji: '🌱', order: 1 },
      { id: uid(), girl: 'maya',  column: 'doing', title: 'Times tables practice',           tag: 'learning', emoji: '📚', order: 0 },
      { id: uid(), girl: 'maya',  column: 'done',  title: 'Bike ride with Dad',              tag: 'activity', emoji: '🚴', order: 0 },
    ],
  };
}

/* ───── Root ───── */

function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState('family'); // 'family' | 'orla' | 'eliza' | 'maya'

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    document.body.className = 'theme-' + view;
  }, [view]);

  const cardsFor = (girlId) => state.cards.filter(c => c.girl === girlId);

  const addCard = (girlId, card) => {
    const cards = state.cards.filter(c => c.girl === girlId && c.column === 'todo');
    const maxOrder = cards.length ? Math.max(...cards.map(c => c.order)) : -1;
    setState(s => ({
      ...s,
      cards: [...s.cards, { id: uid(), girl: girlId, column: 'todo', order: maxOrder + 1, ...card }]
    }));
  };

  const moveCard = (cardId, toColumn) => {
    setState(s => {
      const card = s.cards.find(c => c.id === cardId);
      if (!card) return s;
      const others = s.cards.filter(c => c.girl === card.girl && c.column === toColumn);
      const maxOrder = others.length ? Math.max(...others.map(c => c.order)) : -1;
      return {
        ...s,
        cards: s.cards.map(c =>
          c.id === cardId ? { ...c, column: toColumn, order: maxOrder + 1 } : c
        )
      };
    });
  };

  const deleteCard = (cardId) => {
    setState(s => ({ ...s, cards: s.cards.filter(c => c.id !== cardId) }));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">
            <span className="dot" />
            The Imhasly Family · kanban
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
          onAdd={addCard}
          onMove={moveCard}
          onDelete={deleteCard}
        />
      )}

      <div className="footer-note">
        auto-saved · drag cards between columns · ta-da ✨
      </div>
    </div>
  );
}

/* ───── Family overview ───── */

function FamilyOverview({ state, onPick }) {
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
        </div>
      </div>

      <div className="family-grid">
        {GIRLS.map(g => {
          const cards = state.cards.filter(c => c.girl === g.id);
          const doing = cards.filter(c => c.column === 'doing');
          const todo = cards.filter(c => c.column === 'todo');
          const done = cards.filter(c => c.column === 'done');
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
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───── Girl board ───── */

function GirlBoard({ girl, cards, onAdd, onMove, onDelete }) {
  const todoCount = cards.filter(c => c.column === 'todo').length;
  const doingCount = cards.filter(c => c.column === 'doing').length;
  const doneCount = cards.filter(c => c.column === 'done').length;

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
          />
        ))}
      </div>
    </>
  );
}

/* ───── Column ───── */

function Column({ column, girl, cards, onAdd, onMove, onDelete }) {
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

function KanbanCard({ card, onMove, onDelete }) {
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

  const moveLabels = {
    todo:  { prev: null,    next: 'doing' },
    doing: { prev: 'todo',   next: 'done'  },
    done:  { prev: 'doing',  next: null    },
  };
  const moves = moveLabels[card.column];

  return (
    <div
      className={'kcard' + (card.column === 'done' ? ' done' : '') + (sparkle ? ' sparkle' : '')}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kcard-top">
        {card.emoji && <div className="kcard-emoji">{card.emoji}</div>}
        <div className="kcard-title">{card.title}</div>
        <button className="kcard-close" onClick={() => onDelete(card.id)} aria-label="Delete">×</button>
      </div>
      <div className="kcard-bottom">
        {card.tag ? (
          <span className={'tag ' + card.tag}>{TAGS.find(t => t.id === card.tag)?.label}</span>
        ) : <span />}
        <div className="kcard-actions">
          {moves.prev && (
            <button className="kcard-move" onClick={() => onMove(card.id, moves.prev)} title="Move back" aria-label="Move back">‹</button>
          )}
          {moves.next && (
            <button className="kcard-move" onClick={() => onMove(card.id, moves.next)} title="Move forward" aria-label="Move forward">›</button>
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
  const inputRef = useRef(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const commit = () => {
    const t = title.trim();
    if (!t) { reset(); return; }
    onAdd(girl.id, { title: t, emoji, tag });
    reset();
  };
  const reset = () => {
    setTitle(''); setEmoji(''); setTag(''); setExpanded(false);
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
        <div className="add-card-buttons">
          <button className="btn ghost small" onClick={reset}>Cancel</button>
          <button className="btn primary small" onClick={commit}>Add card</button>
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

/* ───── Mount ───── */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
