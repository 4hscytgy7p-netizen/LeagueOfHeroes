import type { Spell } from '../types/spell';

export interface TooltipConfig {
  offsetX?: number;
  offsetY?: number;
  fadeInDelay?: number;
  fadeOutDelay?: number;
}

export class SpellTooltip {
  private tooltip: HTMLElement | null = null;
  private currentLink: HTMLElement | null = null;
  private hideTimeout: number | null = null;
  private showTimeout: number | null = null;
  private config: Required<TooltipConfig>;
  private spells: Spell[] = [];
  private isHoveringTooltip: boolean = false;

  constructor(config: TooltipConfig = {}) {
    this.config = {
      offsetX: config.offsetX ?? 16,
      offsetY: config.offsetY ?? 16,
      fadeInDelay: config.fadeInDelay ?? 300,
      fadeOutDelay: config.fadeOutDelay ?? 150
    };
  }

  init(tooltipElement: HTMLElement, spells: Spell[]) {
    this.tooltip = tooltipElement;
    this.spells = spells;

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

    document.addEventListener('mouseover', (e) => this.handleMouseOver(e));
    document.addEventListener('mouseout', (e) => this.handleMouseOut(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
  }

  private handleMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('.spell-link') as HTMLElement;

    if (link && link.dataset.spellId) {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }

      this.currentLink = link;
      const spellId = link.dataset.spellId;

      this.showTimeout = window.setTimeout(() => {
        const spell = this.spells.find(s => s.id === spellId);
        if (spell) {
          this.showTooltip(spell, event);
        }
      }, this.config.fadeInDelay);
    }
  }

  private handleMouseOut(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('.spell-link');

    if (link) {
      if (this.showTimeout) {
        clearTimeout(this.showTimeout);
        this.showTimeout = null;
      }

      const relatedTarget = event.relatedTarget as HTMLElement;
      if (relatedTarget && (relatedTarget === this.tooltip || this.tooltip?.contains(relatedTarget))) {
        return;
      }

      this.scheduleHide();
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.tooltip || !this.tooltip.style.display || this.tooltip.style.display === 'none') return;

    const target = event.target as HTMLElement;
    const link = target.closest('.spell-link');

    if (link === this.currentLink) {
      this.positionTooltip(event);
    }
  }

  private scheduleHide() {
    this.hideTimeout = window.setTimeout(() => {
      if (!this.isHoveringTooltip) {
        this.hideTooltip();
      }
    }, this.config.fadeOutDelay);
  }

  private showTooltip(spell: Spell, event: MouseEvent) {
    if (!this.tooltip) return;

    this.tooltip.innerHTML = this.renderTooltipContent(spell);
    this.tooltip.style.display = 'block';
    this.tooltip.setAttribute('aria-hidden', 'false');
    this.positionTooltip(event);
  }

  private hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.style.display = 'none';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltip.innerHTML = '';
    this.currentLink = null;
  }

  private positionTooltip(event: MouseEvent) {
    if (!this.tooltip) return;

    const rect = this.tooltip.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let left = event.clientX + this.config.offsetX;
    let top = event.clientY + this.config.offsetY;

    if (left + rect.width + 12 > vpW) {
      left = vpW - rect.width - 12;
    }

    if (top + rect.height + 12 > vpH) {
      top = Math.max(12, vpH - rect.height - 12);
    }

    left = Math.max(8, left);
    top = Math.max(8, top);

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private renderTooltipContent(spell: Spell): string {
    const levelText = spell.level === 'cantrip' ? 'Заговор' : `${spell.level} уровень`;
    const components = this.formatComponents(spell.components);

    return `
      <div class="tooltip-card">
        <div class="tooltip-header">
          <div class="tooltip-title">${spell.name} <span class="name-en">[${spell.nameEn}]</span></div>
          <div class="tooltip-source">${spell.source.book}, стр. ${spell.source.page}</div>
        </div>
        <div class="tooltip-meta">
          <span class="tooltip-level">${levelText}</span>
          <span class="tooltip-school">${spell.school}</span>
        </div>
        <div class="tooltip-attrs">
          <div><strong>Время:</strong> ${spell.castingTime}</div>
          <div><strong>Дистанция:</strong> ${spell.range}</div>
          <div><strong>Компоненты:</strong> ${components}</div>
          <div><strong>Длительность:</strong> ${spell.duration}</div>
        </div>
        <div class="tooltip-desc">${spell.description}</div>
      </div>
    `;
  }

  private formatComponents(components: { verbal?: boolean; somatic?: boolean; material?: string }): string {
    const parts: string[] = [];

    if (components.verbal) parts.push('В');
    if (components.somatic) parts.push('С');
    if (components.material) {
      parts.push(`М (${components.material})`);
    }

    return parts.join(', ');
  }

  destroy() {
    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
  }
}
