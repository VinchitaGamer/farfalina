const buttons = [
  { name: 'Todas (0)', textLen: 9, hasIcon: false },
  { name: 'Stock & Insumos', textLen: 15, hasIcon: true },
  { name: 'Agenda de Hoy', textLen: 14, hasIcon: true },
  { name: 'Caja', textLen: 4, hasIcon: true }
];

// Calculate approximate widths with px-3 (12px * 2 = 24px padding), text-[11px] font-bold (7.2px per char)
buttons.forEach(b => {
  const iconW = b.hasIcon ? (12 + 4) : 0; // icon 12px + gap 4px
  const textW = b.textLen * 7.2;
  const paddingW = 24; // px-3
  b.calcWidth = Math.round(iconW + textW + paddingW);
});

console.log('Button calculated widths:');
console.table(buttons);

const gap = 6; // gap-1.5 = 6px
const totalButtonsW = buttons.reduce((acc, b) => acc + b.calcWidth, 0) + (buttons.length - 1) * gap;
console.log('Total content width of buttons:', totalButtonsW);

const viewports = [360, 375, 390, 412, 430, 448];
viewports.forEach(w => {
  const innerW = w - 24; // px-3 = 24px padding
  const overflow = totalButtonsW - innerW;
  const status = overflow > 0 ? `+${overflow}px (OVERFLOWS / HORIZONTAL SCROLL)` : `${overflow}px (FITS COMPLETELY)`;
  console.log(`Viewport ${w}px -> Inner: ${innerW}px -> Content: ${totalButtonsW}px -> Status: ${status}`);
});
