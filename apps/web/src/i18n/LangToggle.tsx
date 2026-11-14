import { useLang } from '.';

/** TEMPORARY: language switch for the team. Remove together with src/i18n/ru*.ts. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle">
      {(['en', 'ru'] as const).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
