<script lang="ts">
  /**
   * SignaturePad Component
   * Canvas-based signature capture with touch and mouse support
   * Exports signature as PNG data URL
   */

  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  // Props
  interface Props {
    width?: number;
    height?: number;
    lineColor?: string;
    lineWidth?: number;
    backgroundColor?: string;
    disabled?: boolean;
    label?: string;
  }

  let {
    width = 400,
    height = 200,
    lineColor = '#1a1a2e',
    lineWidth = 2,
    backgroundColor = '#ffffff',
    disabled = false,
    label = 'Firma aquí',
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    change: { isEmpty: boolean; dataUrl: string | null };
    clear: void;
    save: { dataUrl: string };
  }>();

  // State
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDrawing = $state(false);
  let isEmpty = $state(true);
  let lastX = 0;
  let lastY = 0;

  // Lifecycle
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      if (ctx) {
        setupCanvas();
      }
    }

    // Handle window resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
  });

  function setupCanvas() {
    if (!ctx || !canvas) return;

    // Set canvas size accounting for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
  }

  function handleResize() {
    if (isEmpty) {
      setupCanvas();
    }
  }

  // Drawing functions
  function getCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    return { x: 0, y: 0 };
  }

  function startDrawing(e: MouseEvent | TouchEvent) {
    if (disabled || !ctx) return;

    e.preventDefault();
    isDrawing = true;

    const coords = getCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;

    // Start a new path
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing || disabled || !ctx) return;

    e.preventDefault();

    const coords = getCoordinates(e);

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastX = coords.x;
    lastY = coords.y;

    if (isEmpty) {
      isEmpty = false;
      emitChange();
    }
  }

  function stopDrawing() {
    if (isDrawing && ctx) {
      ctx.closePath();
      isDrawing = false;
      emitChange();
    }
  }

  function emitChange() {
    dispatch('change', {
      isEmpty,
      dataUrl: isEmpty ? null : getDataUrl(),
    });
  }

  // Public methods
  export function clear() {
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    isEmpty = true;
    dispatch('clear');
    emitChange();
  }

  export function getDataUrl(type: string = 'image/png', quality: number = 1): string {
    if (!canvas) return '';
    return canvas.toDataURL(type, quality);
  }

  export function getIsEmpty(): boolean {
    return isEmpty;
  }

  export function save(): string | null {
    if (isEmpty) return null;

    const dataUrl = getDataUrl();
    dispatch('save', { dataUrl });
    return dataUrl;
  }

  // For Svelte 5, expose methods via bind
  export function toDataURL(type?: string, quality?: number): string {
    return getDataUrl(type, quality);
  }
</script>

<div class="signature-pad" class:disabled>
  {#if label}
    <span class="signature-label">{label}</span>
  {/if}

  <div class="canvas-container" style="width: {width}px; height: {height}px;">
    <canvas
      bind:this={canvas}
      style="width: 100%; height: 100%;"
      onmousedown={startDrawing}
      onmousemove={draw}
      onmouseup={stopDrawing}
      onmouseleave={stopDrawing}
      ontouchstart={startDrawing}
      ontouchmove={draw}
      ontouchend={stopDrawing}
      ontouchcancel={stopDrawing}
    ></canvas>

    {#if isEmpty}
      <div class="placeholder">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
          <path d="m15 5 4 4"></path>
        </svg>
        <span>Firme aquí</span>
      </div>
    {/if}
  </div>

  <div class="actions">
    <button
      type="button"
      class="btn-clear"
      onclick={clear}
      disabled={disabled || isEmpty}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      </svg>
      Limpiar
    </button>
  </div>
</div>

<style>
  .signature-pad {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: fit-content;
  }

  .signature-pad.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .signature-label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .canvas-container {
    position: relative;
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    background: #fff;
    cursor: crosshair;
    touch-action: none;
    overflow: hidden;
  }

  .canvas-container:hover {
    border-color: #9ca3af;
  }

  canvas {
    display: block;
    border-radius: 6px;
  }

  .placeholder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #9ca3af;
    pointer-events: none;
    user-select: none;
  }

  .placeholder svg {
    width: 32px;
    height: 32px;
  }

  .placeholder span {
    font-size: 14px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-clear {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-clear:hover:not(:disabled) {
    color: #ef4444;
    border-color: #ef4444;
    background: #fef2f2;
  }

  .btn-clear:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .canvas-container {
      max-width: 100%;
    }
  }
</style>
