export const TOKEN_SIZE = 512;
export const TOKEN_RADIUS = 200;
export type TokenTransform = { x: number; y: number; zoom: number; rotation: number; fit: 'fill' | 'contain' };

export function initialTransform(): TokenTransform {
  return { x: 0, y: 0, zoom: 100, rotation: 0, fit: 'fill' };
}

export function imageScale(width: number, height: number, transform: TokenTransform): number {
  const dimension = transform.fit === 'fill' ? Math.min(width, height) : Math.hypot(width, height);
  return (TOKEN_RADIUS * 2 / dimension) * (transform.zoom / 100);
}

export function tokenFilename(value: string): string {
  const name = value.trim().replace(/\.png$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80);
  return `${name || 'token'}.png`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function drawToken(context: CanvasRenderingContext2D, size: number, image: HTMLImageElement | null, border: HTMLImageElement | null, transform: TokenTransform, background: string | null) {
  context.clearRect(0, 0, size, size);
  context.save();
  context.scale(size / TOKEN_SIZE, size / TOKEN_SIZE);
  context.save();
  context.beginPath();
  context.arc(TOKEN_SIZE / 2, TOKEN_SIZE / 2, TOKEN_RADIUS, 0, Math.PI * 2);
  context.clip();
  if (background) { context.fillStyle = background; context.fillRect(0, 0, TOKEN_SIZE, TOKEN_SIZE); }
  if (image) {
    context.translate(TOKEN_SIZE / 2 + transform.x, TOKEN_SIZE / 2 + transform.y);
    context.rotate(transform.rotation * Math.PI / 180);
    const scale = imageScale(image.naturalWidth, image.naturalHeight, transform);
    context.scale(scale, scale);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  }
  context.restore();
  if (border) context.drawImage(border, 0, 0, TOKEN_SIZE, TOKEN_SIZE);
  context.restore();
}
