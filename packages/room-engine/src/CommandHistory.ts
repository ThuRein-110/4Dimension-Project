export class CommandHistory<T> {
  private past: T[] = []; private future: T[] = [];
  constructor(private limit = 100) {}
  get canUndo() { return !!this.past.length; }
  get canRedo() { return !!this.future.length; }
  record(before: T) { this.past.push(structuredClone(before)); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current: T): T | undefined { const previous = this.past.pop(); if (previous !== undefined) this.future.push(structuredClone(current)); return previous; }
  redo(current: T): T | undefined { const next = this.future.pop(); if (next !== undefined) this.past.push(structuredClone(current)); return next; }
  clear() { this.past = []; this.future = []; }
}
