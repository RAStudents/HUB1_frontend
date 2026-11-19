/** Immutable snapshots, with one history entry per completed gesture. */
export class UndoHistory<T> {
  value: T;
  private past: T[] = [];
  private future: T[] = [];
  private gesture: { before: T } | null = null;
  private limit: number;
  constructor(initial: T, limit = 100) { this.value = initial; this.limit = limit; }
  private same(a: T, b: T) { return JSON.stringify(a) === JSON.stringify(b); }
  get canUndo() { return this.gesture ? !this.same(this.gesture.before, this.value) : this.past.length > 0; }
  get canRedo() { return !this.gesture && this.future.length > 0; }
  set(next: T) {
    if (this.same(next, this.value)) return;
    if (!this.gesture) { this.past = [...this.past.slice(-(this.limit - 1)), this.value]; this.future = []; }
    this.value = next;
  }
  begin() { if (!this.gesture) this.gesture = { before: this.value }; }
  commit() {
    if (!this.gesture) return;
    const before = this.gesture.before;
    this.gesture = null;
    if (!this.same(before, this.value)) { this.past = [...this.past.slice(-(this.limit - 1)), before]; this.future = []; }
  }
  cancel() { if (this.gesture) { this.value = this.gesture.before; this.gesture = null; } }
  undo() {
    if (this.gesture) { this.cancel(); return; }
    if (!this.past.length) return;
    this.future.push(this.value); this.value = this.past.pop()!;
  }
  redo() {
    if (!this.canRedo) return;
    this.past.push(this.value); this.value = this.future.pop()!;
  }
  reset(value: T) { this.value = value; this.past = []; this.future = []; this.gesture = null; }
}
