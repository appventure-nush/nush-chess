<template>
  <div>
    <div class="w-[80vw] max-w-[50vh]" id="testboard"></div>
  </div>
</template>

<script>
import "../chessboard.js";

export default {
  mounted() {
    let board = new ChessBoard("testboard", {
      draggable: true,
      position: "start",
      pieceTheme: "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png",
      orientation: "white",
    });
  },
};
</script>