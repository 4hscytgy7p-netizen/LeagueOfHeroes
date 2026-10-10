import { clamp, drawToken, initialTransform, TOKEN_SIZE, tokenFilename } from '../utils/tokenEditor.ts';
import type { TokenTransform } from '../utils/tokenEditor.ts';

type Asset = { blob: Blob; name: string; image: HTMLImageElement; svg: string | null };
type State = {
  art: Asset | null;
  custom: Asset | null;
  border: string;
  borderColor: string;
  recolor: boolean;
  background: 'transparent' | 'color';
  backgroundColor: string;
  transform: TokenTransform;
  size: number;
  filename: string;
};
type SavedAsset = { blob: Blob; name: string };
type Draft = Omit<State, 'art' | 'custom'> & { version: 1; art: SavedAsset | null; custom: SavedAsset | null };

const emptyState = (): State => ({
  art: null, custom: null, border: 'none', borderColor: '#ffffff', recolor: false,
  background: 'transparent', backgroundColor: '#1e293b', transform: initialTransform(), size: 512, filename: 'token',
});
const copyState = (state: State): State => ({ ...state, transform: { ...state.transform } });
const isTextField = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || !!target.closest('input, textarea, select'));

async function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('empty image');
    return image;
  } finally { URL.revokeObjectURL(url); }
}

function parseSvg(text: string): Document {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('SVG повреждён. Выберите другой файл.');
  }
  // External resources can make a canvas impossible to export. Keep uploaded SVGs self-contained.
  document.querySelectorAll('script, foreignObject').forEach(element => element.remove());
  document.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
      if (attribute.localName === 'href' && !attribute.value.startsWith('#') && !attribute.value.startsWith('data:image/')) {
        throw new Error('SVG содержит внешние изображения. Встройте их в SVG или загрузите PNG.');
      }
    }
  });
  return document;
}

function svgBlob(document: Document): Blob {
  return new Blob([new XMLSerializer().serializeToString(document.documentElement)], { type: 'image/svg+xml' });
}

async function readAsset(file: Blob, name: string, border = false): Promise<Asset> {
  const limit = (border ? 5 : 20) * 1024 * 1024;
  if (file.size > limit) throw new Error(`Файл слишком большой. Максимум — ${border ? 5 : 20} МБ.`);
  const extension = name.split('.').pop()?.toLowerCase();
  const svg = file.type === 'image/svg+xml' || extension === 'svg';
  const supported = border ? ['image/png', 'image/svg+xml'] : ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
  const supportedExtensions = border ? ['png', 'svg'] : ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
  if (!supported.includes(file.type) && !(file.type === '' && supportedExtensions.includes(extension || ''))) {
    throw new Error(border ? 'Для рамки выберите PNG или SVG.' : 'Выберите изображение PNG, JPG, WebP, GIF или SVG.');
  }
  let blob = file;
  let text: string | null = null;
  if (svg) {
    const document = parseSvg(await file.text());
    blob = svgBlob(document);
    text = await blob.text();
  }
  try {
    const image = await decodeImage(blob);
    // Store a stable frame of animated images so preview and export always match.
    const stable = document.createElement('canvas');
    stable.width = image.naturalWidth;
    stable.height = image.naturalHeight;
    if (stable.width * stable.height > 40_000_000) throw new Error('Изображение слишком большое: максимум 40 мегапикселей.');
    const context = stable.getContext('2d');
    if (!context) throw new Error('Canvas недоступен в этом браузере.');
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => stable.toBlob(result => result ? resolve(result) : reject(new Error('Не удалось прочитать изображение.')), 'image/png'));
    return { blob: file.type === 'image/gif' || extension === 'gif' ? png : blob, name, image: await decodeImage(png), svg: text };
  } catch (error) {
    if (error instanceof Error && /максимум|Canvas/.test(error.message)) throw error;
    throw new Error('Не удалось прочитать изображение. Файл повреждён или его формат не поддерживается.');
  }
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('league-of-heroes-tokenator', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Хранилище занято другой вкладкой.'));
  });
}

async function draftTransaction(mode: IDBTransactionMode, value?: Draft): Promise<Draft | undefined> {
  const database = await openDraftDatabase();
  try {
    return await new Promise<Draft | undefined>((resolve, reject) => {
      const transaction = database.transaction('drafts', mode);
      const store = transaction.objectStore('drafts');
      const request = mode === 'readonly' ? store.get('current') : value ? store.put(value, 'current') : store.delete('current');
      transaction.oncomplete = () => resolve(mode === 'readonly' ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export function initializeTokenEditor(root: HTMLElement) {
  const get = <T extends HTMLElement>(id: string): T => {
    const element = root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing token editor element: ${id}`);
    return element;
  };
  const canvas = get<HTMLCanvasElement>('token-canvas');
  const context = canvas.getContext('2d');
  const status = get('token-status');
  const error = get('token-error');
  const draftStatus = get('token-draft-status');
  const imageFile = get<HTMLInputElement>('token-image-file');
  const borderFile = get<HTMLInputElement>('token-border-file');
  const download = get<HTMLButtonElement>('token-download');
  const undo = get<HTMLButtonElement>('token-undo');
  const redo = get<HTMLButtonElement>('token-redo');
  const clear = get<HTMLButtonElement>('token-clear');
  const restore = get<HTMLButtonElement>('token-restore');
  const scale = get<HTMLInputElement>('token-scale');
  const scaleNumber = get<HTMLInputElement>('token-scale-number');
  const rotation = get<HTMLInputElement>('token-rotation');
  const rotationNumber = get<HTMLInputElement>('token-rotation-number');
  const borderColor = get<HTMLInputElement>('token-border-color');
  const background = get<HTMLSelectElement>('token-background');
  const backgroundColor = get<HTMLInputElement>('token-bg-color');
  const exportSize = get<HTMLSelectElement>('token-export-size');
  const filename = get<HTMLInputElement>('token-filename');
  const recolor = get<HTMLInputElement>('token-recolor');
  const dropZone = get('token-drop-zone');
  const retryDraft = get<HTMLButtonElement>('token-retry-draft');
  if (!context) { error.textContent = 'Canvas недоступен. Откройте страницу в браузере с поддержкой Canvas.'; error.hidden = false; return; }

  let state = emptyState();
  let history: State[] = [copyState(state)];
  let historyIndex = 0;
  let borderImage: HTMLImageElement | null = null;
  let borderVersion = 0;
  let artVersion = 0;
  let revision = 0;
  let borderBusy = false;
  let artBusy = false;
  let exporting = false;
  let restoring = true;
  let lastClearIndex: number | null = null;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue: Promise<unknown> = Promise.resolve();
  const presets = new Map<string, Promise<string>>();
  let thumbnailAsset: Asset | null = null;
  let thumbnailUrl: string | null = null;

  function showError(message: string) { error.textContent = message; error.hidden = false; }
  function dismissError() { error.hidden = true; error.textContent = ''; }
  function showStatus(message: string) { status.textContent = message; }

  function render() {
    drawToken(context!, canvas.width, state.art?.image || null, borderImage, state.transform, state.background === 'color' ? state.backgroundColor : null);
    const busy = restoring || artBusy || exporting;
    root.dataset.hasImage = String(!!state.art);
    root.setAttribute('aria-busy', String(busy || borderBusy));
    get('token-empty').hidden = !!state.art;
    get<HTMLFieldSetElement>('token-image-controls').disabled = !state.art || busy;
    download.disabled = !state.art || busy || borderBusy;
    clear.disabled = busy || (!state.art && state.border === 'none' && !state.custom);
    undo.disabled = historyIndex === 0 || busy;
    redo.disabled = historyIndex === history.length - 1 || busy;
    restore.hidden = lastClearIndex !== historyIndex || historyIndex === 0;
    restore.disabled = busy;
    root.querySelectorAll<HTMLButtonElement>('[data-upload-art]').forEach(button => {
      button.disabled = busy;
      if (button.closest('.token-image-actions')) button.textContent = state.art ? 'Заменить изображение' : 'Выбрать изображение';
    });
    root.querySelectorAll<HTMLButtonElement>('[data-border]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.border === state.border));
      button.disabled = busy;
    });
    get<HTMLButtonElement>('token-replace-border').disabled = busy;
    [borderColor, background, backgroundColor, exportSize, filename, recolor].forEach(element => element.disabled = busy);
    get('token-image-name').textContent = state.art?.name || 'Изображение не выбрано';
    get('token-border-name').textContent = state.custom?.name || '';
    get('token-custom-options').hidden = state.border !== 'custom';
    get('token-recolor-label').hidden = !state.custom?.svg;
    get('token-border-color-label').hidden = state.border === 'none' || (state.border === 'custom' && (!state.custom?.svg || !state.recolor));
    get('token-bg-color-label').hidden = state.background !== 'color';
    scale.value = scaleNumber.value = String(Math.round(state.transform.zoom));
    rotation.value = rotationNumber.value = String(Math.round(state.transform.rotation));
    borderColor.value = state.borderColor;
    background.value = state.background;
    backgroundColor.value = state.backgroundColor;
    exportSize.value = String(state.size);
    if (document.activeElement !== filename) filename.value = state.filename;
    recolor.checked = state.recolor;
    get('token-export-summary').textContent = `${state.size} × ${state.size} px · ${state.background === 'transparent' ? 'прозрачный' : 'цветной'} фон`;
    const thumb = get<HTMLImageElement>('token-custom-thumb');
    thumb.hidden = !state.custom;
    get('token-custom-plus').hidden = !!state.custom;
    if (thumbnailAsset !== state.custom) {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      thumbnailAsset = state.custom;
      thumbnailUrl = state.custom ? URL.createObjectURL(state.custom.blob) : null;
      if (thumbnailUrl) thumb.src = thumbnailUrl;
      else thumb.removeAttribute('src');
    }
  }

  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = undefined;
    const snapshot = copyState(state);
    const savedRevision = revision;
    const asset = (value: Asset | null): SavedAsset | null => value ? { blob: value.blob, name: value.name } : null;
    const draft: Draft = { ...snapshot, version: 1, art: asset(snapshot.art), custom: asset(snapshot.custom) };
    draftStatus.textContent = 'Сохранение черновика…';
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      try {
        await draftTransaction('readwrite', snapshot.art || snapshot.custom || snapshot.border !== 'none' ? draft : undefined);
        if (savedRevision === revision) {
          draftStatus.textContent = snapshot.art || snapshot.custom || snapshot.border !== 'none' ? 'Черновик сохранён в этом браузере.' : '';
          retryDraft.hidden = true;
        }
      } catch {
        draftStatus.textContent = 'Не удалось сохранить черновик. Проверьте доступ к хранилищу и свободное место в браузере.';
        retryDraft.hidden = false;
      }
    });
  }

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftStatus.textContent = 'Сохранение черновика…';
    draftTimer = setTimeout(saveDraft, 350);
  }

  function commit() {
    revision++;
    const previous = history[historyIndex];
    const equivalent = previous.art === state.art && previous.custom === state.custom &&
      JSON.stringify({ ...previous, art: null, custom: null }) === JSON.stringify({ ...state, art: null, custom: null });
    if (!equivalent) {
      history = history.slice(0, historyIndex + 1);
      history.push(copyState(state));
      if (history.length > 30) history.shift();
      historyIndex = history.length - 1;
      lastClearIndex = null;
    }
    render();
    scheduleDraft();
  }

  async function updateBorder() {
    const version = ++borderVersion;
    const snapshot = copyState(state);
    borderBusy = snapshot.border !== 'none';
    borderImage = null;
    render();
    if (snapshot.border === 'none') return true;
    try {
      let image: HTMLImageElement;
      if (snapshot.border === 'custom' && snapshot.custom && (!snapshot.custom.svg || !snapshot.recolor)) {
        image = snapshot.custom.image;
      } else {
        let svg: string;
        if (snapshot.border === 'custom') {
          if (!snapshot.custom?.svg) throw new Error('Выберите свою рамку.');
          svg = snapshot.custom.svg;
        } else {
          if (!presets.has(snapshot.border)) {
            presets.set(snapshot.border, fetch(`/images/borders/${snapshot.border.replace('-', '')}.svg`).then(async response => {
              if (!response.ok) throw new Error('Не удалось загрузить рамку. Повторите выбор.');
              return response.text();
            }).catch(error => { presets.delete(snapshot.border); throw error; }));
          }
          svg = await presets.get(snapshot.border)!;
        }
        const parsed = parseSvg(svg);
        const isColor = (paint: string) => paint.trim() !== 'transparent' && CSS.supports('color', paint.trim());
        parsed.querySelectorAll('*').forEach(element => {
          // Mask and clipping colors encode geometry, not the visible frame color.
          if (element.closest('mask, clipPath, filter, linearGradient, radialGradient, pattern')) return;
          for (const attribute of ['fill', 'stroke']) {
            const paint = element.getAttribute(attribute);
            if (paint && isColor(paint)) element.setAttribute(attribute, snapshot.borderColor);
          }
          const style = (element as SVGElement).style;
          if (style) for (const property of ['fill', 'stroke']) {
            const paint = style.getPropertyValue(property);
            if (paint && isColor(paint)) style.setProperty(property, snapshot.borderColor, style.getPropertyPriority(property));
          }
        });
        image = await decodeImage(svgBlob(parsed));
      }
      if (version !== borderVersion) return false;
      borderImage = image;
      return true;
    } catch (failure) {
      if (version !== borderVersion) return false;
      showError(failure instanceof Error ? failure.message : 'Не удалось загрузить рамку.');
      state.border = 'none';
      return false;
    } finally {
      if (version === borderVersion) { borderBusy = false; render(); }
    }
  }

  async function loadArt(file: File) {
    if (restoring || exporting) return;
    const version = ++artVersion;
    artBusy = true;
    dismissError();
    showStatus('Загрузка изображения…');
    render();
    try {
      const asset = await readAsset(file, file.name || 'portrait.png');
      if (version !== artVersion) return;
      state.art = asset;
      state.transform = initialTransform();
      state.filename = tokenFilename(asset.name.replace(/\.[^.]+$/, '')).replace(/\.png$/, '');
      artBusy = false;
      commit();
      showStatus('Портрет загружен. Перетащите его, чтобы выбрать кадр.');
      canvas.focus({ preventScroll: true });
    } catch (failure) {
      if (version === artVersion) {
        showError(failure instanceof Error ? failure.message : 'Не удалось загрузить портрет.');
        showStatus(state.art ? 'Предыдущее изображение сохранено.' : 'Выберите другое изображение.');
      }
    } finally { if (version === artVersion) { artBusy = false; render(); } }
  }

  async function loadBorder(file: File) {
    const version = ++artVersion;
    artBusy = true;
    dismissError();
    showStatus('Загрузка своей рамки…');
    render();
    try {
      const asset = await readAsset(file, file.name, true);
      if (version !== artVersion) return;
      state.custom = asset;
      state.border = 'custom';
      state.recolor = false;
      await updateBorder();
      artBusy = false;
      commit();
      showStatus('Своя рамка загружена.');
    } catch (failure) {
      if (version === artVersion) {
        showError(failure instanceof Error ? failure.message : 'Не удалось загрузить рамку.');
        showStatus('Предыдущая рамка сохранена. Выберите другой PNG или SVG.');
      }
    }
    finally { if (version === artVersion) { artBusy = false; render(); } }
  }

  function changeTransform(change: Partial<TokenTransform>) {
    if (!state.art || artBusy || restoring || exporting) return;
    state.transform = { ...state.transform, ...change };
    commit();
  }

  async function travel(direction: number) {
    const next = historyIndex + direction;
    if (next < 0 || next >= history.length || restoring || artBusy || exporting) return;
    historyIndex = next;
    revision++;
    state = copyState(history[next]);
    await updateBorder();
    render();
    scheduleDraft();
    showStatus(direction < 0 ? 'Действие отменено.' : 'Действие повторено.');
  }

  root.querySelectorAll<HTMLButtonElement>('[data-upload-art]').forEach(button => button.addEventListener('click', () => imageFile.click()));
  imageFile.addEventListener('change', () => {
    const file = imageFile.files?.[0];
    imageFile.value = '';
    if (file) void loadArt(file);
  });
  borderFile.addEventListener('change', () => {
    const file = borderFile.files?.[0];
    borderFile.value = '';
    if (file) void loadBorder(file);
  });
  get('token-replace-border').addEventListener('click', () => borderFile.click());
  root.querySelectorAll<HTMLButtonElement>('[data-border]').forEach(button => button.addEventListener('click', async () => {
    const border = button.dataset.border!;
    if (border === 'custom' && !state.custom) { borderFile.click(); return; }
    dismissError();
    state.border = border;
    if (await updateBorder()) { commit(); showStatus(border === 'none' ? 'Рамка убрана.' : 'Рамка выбрана.'); }
    else if (state.border === 'none') commit();
  }));
  borderColor.addEventListener('input', () => { state.borderColor = borderColor.value; void updateBorder(); });
  borderColor.addEventListener('change', commit);
  recolor.addEventListener('change', async () => { state.recolor = recolor.checked; await updateBorder(); commit(); });
  background.addEventListener('change', () => { state.background = background.value === 'color' ? 'color' : 'transparent'; commit(); });
  backgroundColor.addEventListener('input', () => { state.backgroundColor = backgroundColor.value; render(); });
  backgroundColor.addEventListener('change', commit);
  exportSize.addEventListener('change', () => { state.size = Number(exportSize.value); commit(); });
  filename.addEventListener('input', () => { state.filename = filename.value; scheduleDraft(); });
  filename.addEventListener('change', commit);
  retryDraft.addEventListener('click', saveDraft);

  function bindTransform(range: HTMLInputElement, number: HTMLInputElement, key: 'zoom' | 'rotation', min: number, max: number) {
    range.addEventListener('input', () => { state.transform[key] = Number(range.value); render(); });
    range.addEventListener('change', commit);
    number.addEventListener('input', () => {
      const value = number.valueAsNumber;
      if (Number.isFinite(value) && value >= min && value <= max) {
        state.transform[key] = value;
        range.value = String(value);
        drawToken(context!, canvas.width, state.art?.image || null, borderImage, state.transform, state.background === 'color' ? state.backgroundColor : null);
      }
    });
    number.addEventListener('change', () => {
      state.transform[key] = clamp(Number.isFinite(number.valueAsNumber) ? number.valueAsNumber : state.transform[key], min, max);
      commit();
    });
  }
  bindTransform(scale, scaleNumber, 'zoom', 10, 500);
  bindTransform(rotation, rotationNumber, 'rotation', -180, 180);
  get('token-center').addEventListener('click', () => changeTransform({ x: 0, y: 0 }));
  get('token-reset-scale').addEventListener('click', () => changeTransform({ zoom: 100 }));
  get('token-reset-rotation').addEventListener('click', () => changeTransform({ rotation: 0 }));
  get('token-fill').addEventListener('click', () => changeTransform({ fit: 'fill', zoom: 100, x: 0, y: 0 }));
  get('token-fit').addEventListener('click', () => changeTransform({ fit: 'contain', zoom: 100, x: 0, y: 0 }));
  get('token-reset').addEventListener('click', () => changeTransform(initialTransform()));
  undo.addEventListener('click', () => void travel(-1));
  redo.addEventListener('click', () => void travel(1));
  restore.addEventListener('click', () => void travel(-1));
  clear.addEventListener('click', () => {
    artVersion++;
    borderVersion++;
    borderBusy = false;
    borderImage = null;
    state = emptyState();
    dismissError();
    commit();
    lastClearIndex = historyIndex;
    render();
    showStatus('Редактор очищен. Можно отменить очистку.');
  });

  let drag: { pointer: number; x: number; y: number; initial: TokenTransform } | null = null;
  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * TOKEN_SIZE / rect.width, y: (event.clientY - rect.top) * TOKEN_SIZE / rect.height };
  };
  canvas.addEventListener('pointerdown', event => {
    if (!state.art || event.button !== 0 || artBusy || restoring || exporting || drag) return;
    const position = point(event);
    drag = { pointer: event.pointerId, ...position, initial: { ...state.transform } };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const position = point(event);
    state.transform.x = drag.initial.x + position.x - drag.x;
    state.transform.y = drag.initial.y + position.y - drag.y;
    render();
  });
  function stopDrag(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    commit();
  }
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('lostpointercapture', stopDrag);
  canvas.addEventListener('keydown', event => {
    if (!state.art || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    changeTransform({ x: state.transform.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: state.transform.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) });
  });
  root.addEventListener('keydown', event => {
    if (isTextField(event.target) || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    void travel(event.shiftKey ? 1 : -1);
  });

  let dragDepth = 0;
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files');
  dropZone.addEventListener('dragenter', event => { if (hasFiles(event)) { event.preventDefault(); dragDepth++; dropZone.classList.add('is-dragging'); } });
  dropZone.addEventListener('dragover', event => { if (hasFiles(event)) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; } });
  dropZone.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropZone.classList.remove('is-dragging'); });
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files[0];
    if (file) void loadArt(file);
  });
  document.addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault(); });
  document.addEventListener('drop', event => {
    if (hasFiles(event) && event.target instanceof Node && !dropZone.contains(event.target)) {
      event.preventDefault();
      showStatus('Перетащите изображение на область предпросмотра.');
    }
  });
  document.addEventListener('paste', event => {
    if (isTextField(event.target)) return;
    const item = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) { event.preventDefault(); void loadArt(file); }
  });

  download.addEventListener('click', async () => {
    if (!state.art || artBusy || borderBusy || restoring || exporting) return;
    const snapshot = copyState(state);
    const frame = borderImage;
    exporting = true;
    dismissError();
    download.textContent = 'Подготовка PNG…';
    showStatus('Подготовка PNG…');
    render();
    try {
      const output = document.createElement('canvas');
      output.width = output.height = snapshot.size;
      const outputContext = output.getContext('2d');
      if (!outputContext) throw new Error('Не удалось создать PNG.');
      drawToken(outputContext, snapshot.size, snapshot.art!.image, frame, snapshot.transform, snapshot.background === 'color' ? snapshot.backgroundColor : null);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = tokenFilename(snapshot.filename);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Let browsers finish starting the download before releasing the URL.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      showStatus(`Готово: ${anchor.download}, ${snapshot.size} × ${snapshot.size} px. Скачивание начато.`);
    } catch { showError('Не удалось экспортировать PNG. Попробуйте меньший размер или замените свою рамку.'); }
    finally { exporting = false; download.textContent = 'Скачать PNG'; render(); }
  });

  const resize = () => {
    const displaySize = canvas.getBoundingClientRect().width;
    const pixels = Math.max(1, Math.round(displaySize * Math.min(window.devicePixelRatio || 1, 2)));
    if (canvas.width !== pixels) { canvas.width = canvas.height = pixels; render(); }
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && draftTimer) saveDraft(); });
  window.addEventListener('pagehide', () => { if (draftTimer) saveDraft(); });

  render();
  showStatus('Проверка сохранённого черновика…');
  void (async () => {
    try {
      const draft = await draftTransaction('readonly');
      if (draft?.version === 1) {
        const validColor = (value: string) => /^#[\da-f]{6}$/i.test(value);
        if (!['none', 'preset-1', 'preset-2', 'preset-3', 'custom'].includes(draft.border) ||
          ![512, 1024, 1536].includes(draft.size) || !validColor(draft.borderColor) || !validColor(draft.backgroundColor) ||
          typeof draft.filename !== 'string' || typeof draft.recolor !== 'boolean' ||
          !['fill', 'contain'].includes(draft.transform?.fit) || !['transparent', 'color'].includes(draft.background) ||
          ![draft.transform.x, draft.transform.y, draft.transform.zoom, draft.transform.rotation].every(Number.isFinite)) {
          throw new Error('invalid draft');
        }
        const art = draft.art ? await readAsset(draft.art.blob, draft.art.name) : null;
        const custom = draft.custom ? await readAsset(draft.custom.blob, draft.custom.name, true) : null;
        const { version: _version, art: _art, custom: _custom, ...settings } = draft;
        state = { ...settings, art, custom, transform: { ...draft.transform, zoom: clamp(draft.transform.zoom, 10, 500), rotation: clamp(draft.transform.rotation, -180, 180) } };
        if (state.border === 'custom' && !custom) state.border = 'none';
        await updateBorder();
        history = [emptyState(), copyState(state)];
        historyIndex = 1;
        draftStatus.textContent = 'Черновик восстановлен из этого браузера.';
        showStatus('Продолжайте работу с сохранённым токеном.');
      } else showStatus('Выберите изображение, чтобы начать.');
    } catch {
      draftStatus.textContent = 'Черновик недоступен. Можно начать новый токен; сохранение будет проверено после изменений.';
      showStatus('Выберите изображение, чтобы начать.');
    } finally { restoring = false; render(); resize(); }
  })();
}
