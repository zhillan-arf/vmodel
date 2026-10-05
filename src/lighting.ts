import { DirectionalLight, HemisphereLight } from 'three';
import type { StudioSettings } from './types';

export const lightPresets = {
  studio: { sky: 0xffffff, ground: 0x91a2bf, ambient: 2, key: 0xfff4e9, keyPower: 2.1, fill: 0x92dcff, fillPower: .7 },
  warm: { sky: 0xf5d6a5, ground: 0x543722, ambient: .85, key: 0xffdb9e, keyPower: 1.1, fill: 0xe2a76d, fillPower: .15 },
  violet: { sky: 0xfc9de8, ground: 0x6940af, ambient: 1, key: 0xf2a1ed, keyPower: 1, fill: 0x9b72fa, fillPower: .4 },
} as const;

export class StudioLights {
  readonly ambient = new HemisphereLight();
  readonly key = new DirectionalLight();
  readonly fill = new DirectionalLight();
  constructor() {
    this.key.position.set(1, 2, 3);
    this.fill.position.set(-2, 1, -1);
  }
  configure(settings: StudioSettings) {
    const preset = lightPresets[settings.lighting];
    this.ambient.color.set(preset.sky);
    this.ambient.groundColor.set(preset.ground);
    this.ambient.intensity = preset.ambient * settings.lightIntensity;
    this.key.color.set(preset.key);
    this.key.intensity = preset.keyPower * settings.lightIntensity;
    this.fill.color.set(preset.fill);
    this.fill.intensity = preset.fillPower * settings.lightIntensity;
  }
}
