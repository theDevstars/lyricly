import { GROUPS, stylesIn } from '../styles/registry';

interface StyleTilesProps {
  activeId: string;
  previewId: string;
  pinned: string[];
  onPick: (id: string) => void;
}

export function StyleTiles({ activeId, previewId, pinned, onPick }: StyleTilesProps) {
  return (
    <section className="mw-tiles">
      {GROUPS.map((group) => (
        <div key={group.id} className="tile-group">
          <h2>
            {group.title} <span>{group.blurb}</span>
          </h2>
          <div className="tile-row">
            {stylesIn(group.id).map((style) => (
              <button
                type="button"
                key={style.id}
                className={`tile ${previewId === style.id ? 'previewing' : ''}`}
                onClick={() => onPick(style.id)}
              >
                <div
                  className="tile-thumb"
                  style={{
                    background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
                  }}
                >
                  <span>{style.sample ?? style.name}</span>
                  {style.isNew && <em className="tile-new">New</em>}
                </div>
                <div className="tile-meta">
                  <strong>{style.name}</strong>
                  {activeId === style.id && (
                    <em className="tile-active" title="Active style">
                      ✓
                    </em>
                  )}
                  {pinned.includes(style.id) && (
                    <em className="tile-pin" title="Pinned to the tray">
                      ★
                    </em>
                  )}
                </div>
                <p>{style.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
