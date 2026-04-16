import BootScene from "./scenes/BootScene";

const config = {
  type: Phaser.AUTO,
  width: 380,
  height: 620,
  parent: "game-container",
  backgroundColor: "#14142b",

  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 900 },
      debug: false
    }
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [BootScene]
};

export default config;