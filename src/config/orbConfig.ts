import type { ISourceOptions } from "tsparticles-engine";

export const orbConfig: ISourceOptions = {
  particles: {
    number: {
      value: 150,
      density: {
        enable: true,
        value_area: 800,
      },
    },
    color: {
      value: ["#8A2BE2", "#00BFFF", "#FFFFFF"], // Default: Purple, Blue, White
    },
    shape: {
      type: "circle",
    },
    opacity: {
      value: { min: 0.1, max: 0.6 },
      animation: {
        enable: true,
        speed: 1,
        sync: false,
      },
    },
    size: {
      value: { min: 1, max: 3 },
      animation: {
        enable: true,
        speed: 2,
        sync: false,
      },
    },
    links: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: "none",
      random: true,
      straight: false,
      out_mode: "out",
    },
  },
  interactivity: {
    detect_on: "canvas",
    events: {
      onhover: {
        enable: true,
        mode: "bubble",
      },
      resize: true,
    },
    modes: {
      bubble: {
        distance: 100,
        size: 6,
        duration: 2,
        opacity: 1,
      },
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
      quantity: 5,
      delay: 0.15,
    },
    size: {
      width: 0,
      height: 0,
    },
  },
};