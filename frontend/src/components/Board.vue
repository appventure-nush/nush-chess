<template>
  <div>
    <div :id="id" class="w-[500px]"></div>
  </div>
</template>

<script>
import ChessBoard from "chessboardjs-vue";
import { ref } from "vue";

export default {
  setup() {
    const board = ref({});
    return { board };
  },

  mounted() {
    console.log("role" + this.role);

    this.board.value = new ChessBoard(this.id, {
      draggable: true,
      position: this.fen,
      onDragStart: this.onDragStart,
      onDrop: this.onDrop,
      onSnapEnd: this.onSnapEnd,
      pieceTheme: "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png",
      orientation: this.role == "w" ? "white" : "black",
    });
  },

  props: {
    fen: "",
    role: "",
    id: {
      type: String,
      default: "chessboard",
    },
    game: {},
  },

  methods: {
    onDragStart(source, piece, position, orientation) {
      // do not pick up pieces if the game is over
      let game = this.game;
      console.log(game);

      if (game.isGameOver()) return false;

      // Can't play if not our turn
      console.log(game.turn(), this.role[0]);
      if (game.turn() !== this.role[0]) {
        return false;
      }

      // only pick up pieces for the side to move
      if (
        (game.turn() === "w" && piece.search(/^b/) !== -1) ||
        (game.turn() === "b" && piece.search(/^w/) !== -1)
      ) {
        return false;
      }
      return true;
    },

    onDrop(source, target) {
      // see if the move is legal
      let game = this.game;
      console.log(game);
      let socket = this.$socket;

      var move = game.move({
        from: source,
        to: target,
      });

      if (move === null) {
        move = game.move({
          from: source,
          to: target,
          promotion: "q",
        });

        if (move === null) {
          return "snapback";
        }
      }

      socket.emit("vote", move.san);
      this.$emit("updateStatus");
    },

    onSnapEnd() {
      this.board.value.position(this.game.fen());
    },
  },

  watch: {
    fen: function (newFen) {
      console.log(newFen);
      if (this.board) {
        this.board.value.position(newFen);
      }
    },
    role: function (newRole) {
      if (this.board) {
        console.log(newRole);
        this.board.value.orientation(newRole == "w" ? "white" : "black");
      }
    },
  },
};
</script>

<style lang="scss" scoped>
</style>