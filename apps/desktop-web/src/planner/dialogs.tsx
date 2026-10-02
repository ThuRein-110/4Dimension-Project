import { useEffect, useRef, useSyncExternalStore } from 'react';

interface Request { title: string; detail: string; input: boolean; initial: string; resolve: (result: string | null) => void }
let request: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function askName(title: string, initial: string) {
  return new Promise<string | null>(resolve => { request?.resolve(null); request = { title, initial, detail: '', input: true, resolve }; emit(); });
}
export async function confirmAction(title: string, detail: string) {
  return (await new Promise<string | null>(resolve => { request?.resolve(null); request = { title, detail, input: false, initial: '', resolve }; emit(); })) !== null;
}
function finish(value: string | null) { const current = request; request = null; emit(); current?.resolve(value); }
export function DialogHost() {
  const active = useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => request);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (active) dialog.current?.showModal(); else dialog.current?.close(); }, [active]);
  return <dialog className="planner-dialog" ref={dialog} onCancel={event => { event.preventDefault(); finish(null); }}>
    {active && <form key={active.title} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const value = active.input ? String(form.get('name') ?? '').trim() : 'yes'; if (value) finish(value); }}>
      <h2>{active.title}</h2>{active.detail && <p>{active.detail}</p>}
      {active.input && <label>Name<input name="name" defaultValue={active.initial} required maxLength={100} autoFocus /></label>}
      <div className="dialog-actions"><button type="button" onClick={() => finish(null)}>Cancel</button><button className="primary" type="submit">{active.input ? 'Save' : 'Confirm'}</button></div>
    </form>}
  </dialog>;
}
