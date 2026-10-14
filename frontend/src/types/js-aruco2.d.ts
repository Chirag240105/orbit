// Minimal types for the parts of js-aruco2 ORBIT uses (the package ships none).
declare module "js-aruco2" {
  type Image = { width: number; height: number; data: Uint8ClampedArray };
  namespace AR {
    class Detector {
      constructor(config?: { dictionaryName?: string; maxHammingDistance?: number });
      detect(image: Image): { id: number; corners: { x: number; y: number }[]; hammingDistance: number }[];
    }
    class Dictionary {
      constructor(name: string);
      codeList: string[];
      markSize: number;
      generateSVG(id: number): string;
    }
  }
}
