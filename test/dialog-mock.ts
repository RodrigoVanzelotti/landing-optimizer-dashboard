// jsdom has no native dialog lifecycle; browser checks cover focus trapping and backdrop hit testing.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value() { this.setAttribute('open', ''); this.querySelector('button')?.focus(); } },
  close: { configurable: true, value() { this.removeAttribute('open'); } },
});
