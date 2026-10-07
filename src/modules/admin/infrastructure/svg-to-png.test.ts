import { afterEach, describe, expect, it, vi } from "vitest";
import { svgToPngDataUrl } from "./svg-to-png";

const makeSvg = () => document.createElementNS("http://www.w3.org/2000/svg", "svg");

function stubImage(outcome: "load" | "error") {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        void value;
        setTimeout(() => (outcome === "load" ? this.onload?.() : this.onerror?.()), 0);
      }
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("svgToPngDataUrl", () => {
  it("sem gráfico → null", async () => {
    expect(await svgToPngDataUrl(null)).toBeNull();
  });

  it("gráfico sem tamanho (jsdom, fora do layout) → null", async () => {
    expect(await svgToPngDataUrl(makeSvg())).toBeNull();
  });

  it("imagem que não carrega → null, sem lançar", async () => {
    const svg = makeSvg();
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: 720, height: 300 } as DOMRect);
    stubImage("error");
    expect(await svgToPngDataUrl(svg)).toBeNull();
  });

  it("caminho feliz: desenha no canvas em escala e devolve o PNG", async () => {
    const svg = makeSvg();
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: 720, height: 300 } as DOMRect);
    stubImage("load");
    const ctx = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAA");
    expect(await svgToPngDataUrl(svg, 2)).toBe("data:image/png;base64,AAA");
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 600);
  });
});
