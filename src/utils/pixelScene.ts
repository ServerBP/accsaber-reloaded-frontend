export function cell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  ps: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(col * ps, row * ps, ps, ps)
}

export function drawDitheredBands(
  ctx: CanvasRenderingContext2D,
  cols: number,
  ps: number,
  colors: string[],
  fromRow: number,
  toRow: number,
) {
  const bandRows = (toRow - fromRow) / colors.length
  for (let b = 0; b < colors.length; b++) {
    const y0 = fromRow + Math.floor(b * bandRows)
    const y1 = b === colors.length - 1 ? toRow + 5 : fromRow + Math.floor((b + 1) * bandRows)
    ctx.fillStyle = colors[b]
    ctx.fillRect(0, y0 * ps, cols * ps, (y1 - y0) * ps)
    if (b > 0) {
      for (let col = 0; col < cols; col++) {
        if ((col * 7 + y0 * 13) % 19 < 8) cell(ctx, col, y0, ps, colors[b - 1])
        if ((col * 11 + y0 * 5) % 19 < 8) cell(ctx, col, y0 + 1, ps, colors[b - 1])
      }
    }
  }
}
