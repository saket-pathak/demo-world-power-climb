import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Images
    this.load.image(
      "player",
      "assets/images/player.png"
    );

    this.load.image(
      "platform",
      "assets/images/platform.png"
    );

    this.load.image(
      "oil",
      "assets/images/oil.png"
    );

    this.load.image(
      "heart",
      "assets/images/heart.png"
    );
  }

  create() {
    this.add.text(
      80,
      280,
      "DEMO WORLD\nLoading Complete",
      {
        fontSize: "28px",
        fontFamily: "Arial",
        align: "center",
        color: "#ffffff"
      }
    );

    // temporary next step
    this.time.delayedCall(1000, () => {
      console.log("Ready for MenuScene");
    });
  }
}