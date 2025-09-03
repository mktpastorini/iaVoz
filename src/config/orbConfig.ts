import type { ISourceOptions } from "tsparticles-engine";

export const orbConfig: ISourceOptions = {
  fullscreen: false,
  particles: {
    number: {
      value: 0,
    },
    color: {
      value: ["#8A2BE2", "#00BFFF", "#FFFFFF"],
    },
    shape: {
      type: "circle",
    },
    opacity: {
      value: { min: 0.1, max: 0.8 },
      animation: {
        enable: true,
        speed: 1,
        sync: false,
      },
    },
    size: {
      value: { min: 1, max: 4 },
    },
    links: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 1.5,
      direction: "outside",
      straight: false,
    },
    life: {
      duration: {
        sync: false,
        value: 3,
      },
      delay: {
        sync: false,
        value: 2,
      },
      count: 1,
    },
  },
  interactivity: {
    detect_on: "canvas",
    events: {
      resize: true,
    },
  },
  retina_detect: true,
  background: {
    color: "transparent",
  },
  emitters: {
    position: {
      x: 50,
      y: 50,
    },
    rate: {
      quantity: 10,
      delay: 0.1,
    },
    size: {
      width: 0,
      height: 0,
    },
  },
};