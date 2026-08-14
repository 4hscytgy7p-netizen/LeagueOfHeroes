import type { TooltipConfig } from './spellTooltip';

interface Item {
  id: string;
  name: string;
  nameEn?: string;
  type?: string;
  cost?: string;
  weight?: string;
  sourceBook?: string;
  description?: string;
}

export class ItemTooltip {
  private tooltip: HTMLElement | null = null;
  private items: Item[] = [];
  private hideTimeout: number | null = null;
  private showTimeout: number | null = null;
  private config: Required<TooltipConfig> = {
    offsetX: 16,
    offsetY: 16,
    fadeInDelay: 220,
    fadeOutDelay: 120
  };
  private isHoveringTooltip: boolean = false;

  constructor(config: Partial<TooltipConfig> = {}) {
    this.config = {
      offsetX: config.offsetX ?? this.config.offsetX,
      offsetY: config.offsetY ?? this.config.offsetY,
      fadeInDelay: config.fadeInDelay ?? this.config.fadeInDelay,
      fadeOutDelay: config.fadeOutDelay ?? this.config.fadeOutDelay
    };
  }

  init(tooltipElement: HTMLElement, items?: Item[]) {
    this.tooltip = tooltipElement;
    if (items && items.length) this.items = items;

    if (this.tooltip) {
      this.tooltip.addEventListener('mouseenter', () => {
        this.isHoveringTooltip = true;
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
      });

      this.tooltip.addEventListener('mouseleave', () => {
        this.isHoveringTooltip = false;
        this.scheduleHide();
      });
    }

    document.addEventListener('mouseover', (e) => this.handleMouseOver(e as MouseEvent));
    document.addEventListener('mouseout', (e) => this.handleMouseOut(e as MouseEvent));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e as MouseEvent));

    this.annotateItemAnchors(document.body);
  }

  private annotateItemAnchors(container: ParentNode | Document) {
    const anchors = container.querySelectorAll('a[href*="/items/"]');
    anchors.forEach(a => {
      if (!a.classList.contains('item-link')) {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/items\/(.+?)(?:[\/\?#]|$)/);
        if (m) {
          a.classList.add('item-link');
          (a as HTMLElement).dataset.itemId = decodeURIComponent(m[1]);
        }
      }
    });
  }

  private async loadRegularItems(): Promise<Item[]> {
    if (this.items && this.items.length) return this.items;
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        this.items = data;
        return this.items;
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  private handleMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('.item-link') as HTMLElement | null;
    if (link && link.dataset.itemId) {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }

      const itemId = link.dataset.itemId;
      this.showTimeout = window.setTimeout(async () => {
        let item = this.items.find(i => i.id === itemId);
        if (!item) {
          const items = await this.loadRegularItems();
          item = items.find(i => i.id === itemId) || null;
        }
        if (item && this.tooltip) this.showTooltip(item, event);
      }, this.config.fadeInDelay);
    }
  }

  private handleMouseOut(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('.item-link');
    if (link) {
      if (this.showTimeout) {
        clearTimeout(this.showTimeout);
        this.showTimeout = null;
      }
      const related = event.relatedTarget as HTMLElement | null;
      if (related && (related === this.tooltip || (this.tooltip && this.tooltip.contains(related)))) {
        return;
      }
      this.scheduleHide();
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.tooltip || this.tooltip.style.display === 'none') return;
    const target = event.target as HTMLElement;
    const link = target.closest('.item-link');
    if (link) {
      this.positionTooltip(event);
    }
  }

  private scheduleHide() {
    this.hideTimeout = window.setTimeout(() => {
      if (!this.isHoveringTooltip) this.hideTooltip();
    }, this.config.fadeOutDelay);
  }

  private showTooltip(item: Item, event: MouseEvent) {
    if (!this.tooltip) return;
    this.tooltip.innerHTML = this.renderTooltipContent(item);
    this.tooltip.style.display = 'block';
    this.tooltip.setAttribute('aria-hidden', 'false');
    this.positionTooltip(event);
  }

  private hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.style.display = 'none';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.innerHTML = '';
  }

  private positionTooltip(event: MouseEvent) {
    if (!this.tooltip) return;
    const rect = this.tooltip.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = event.clientX + this.config.offsetX;
    let top = event.clientY + this.config.offsetY;

    if (event.clientX > vpW * 0.66) {
      left = event.clientX - rect.width - this.config.offsetX;
    }

    if (left + rect.width + 12 > vpW) left = vpW - rect.width - 12;
    if (top + rect.height + 12 > vpH) top = Math.max(12, vpH - rect.height - 12);

    left = Math.max(8, left);
    top = Math.max(8, top);

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private renderTooltipContent(item: Item): string {
    return `
      <div class="tooltip-card">
        <div class="tooltip-header">
          <div class="tooltip-title">${item.name} <span class="name-en">[${item.nameEn || ''}]</span></div>
          <div class="tooltip-source">${item.sourceBook || ''}</div>
        </div>
        <div class="tooltip-meta">
          <span class="tooltip-type">${item.type || ''}</span>
          <span class="tooltip-cost">${item.cost || ''}</span>
          <span class="tooltip-weight">${item.weight || ''}</span>
        </div>
        <div class="tooltip-desc">${item.description || ''}</div>
      </div>
    `;
  }

  destroy() {
    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
  }
}

export default ItemTooltip;
