<template>
  <div class="flex flex-col gap-4">
    <div v-if="state.auth" class="flex gap-4">
      <span class="fixed top-0 left-0 p-4 text-xl">
        chess.<span class="text-nush-light">nush</span>.app
      </span>
      <div class="flex-1">
        <div class="flex gap-4">
          <!-- sidebar -->
          <div class="flex flex-col gap-4">
            <span> <br /> </span>
            <div class="outline-none rounded p-4 bg-[#F0D9B5] text-black">
              <span class="text-xl">Team {{ state.group }}</span>
              <img
                :src="`https://chessboardjs.com/img/chesspieces/alpha/${state.role}K.png`"
                class="w-12 h-12 m-auto"
              />
              <span class="text-md">
                Playing as {{ state.role == "w" ? "white" : "black" }}
              </span>
            </div>

            <div
              class="outline-none rounded p-4 bg-[#B58863] text-white text-xl"
            >
              <span>Voting window</span> <br />

              <span class="font-mono text-md">
                {{
                  Math.max(
                    (state.nextVoteTimestamp - state.time.getTime()) / 1000,
                    0
                  ).toFixed(2)
                }}s
              </span>
              <br />
              <span class="text-sm" v-if="state.game.turn() === state.role">
                You have not voted
              </span>
            </div>
            <div class="outline-none rounded p-4 bg-[#F0D9B5] text-black">
              <span class="text-xl"> {{ state.numVotes }} votes </span> <br />
              <span> of {{ state.numPlayers }} players </span>
            </div>
          </div>
          <div>
            <div class="text-2xl mb-2">
              <span> {{ state.status }} </span>
            </div>
            <Board
              @updateStatus="updateStatus(state.game)"
              :fen="state.fen"
              :role="state.role"
              id="chessboard"
              :game="state.game"
            ></Board>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <span> <br /> </span>
        <ol class="outline outline-1 outline-[#F0D9B5] rounded w-80 p-4 h-full">
          <li v-for="err in state.errors" :key="err">
            <span> {{ err }}</span>
          </li>
        </ol>
      </div>
    </div>

    <div v-else class="flex flex-col gap-2 mb-10">
      <span class="text-2xl">
        chess.<span class="text-nush-mid">nush</span>.app
      </span>
      <br />
      <button
        class="
          transition
          bg-nush-dark
          hover:bg-nush-mid
          outline-none
          text-white
          font-bold
          py-2
          px-4
          rounded
        "
        @click="signIn"
      >
        Enter with Office365
      </button>
    </div>
  </div>
</template>

<script>
import Board from "./components/Board.vue";
import { Chess } from "chess.js";

import { reactive, ref } from "vue";

export default {
  name: "App",
  components: {
    Board,
  },

  setup() {
    const state = reactive({
      group: "",
      auth: false,
      status: "",
      role: "",
      fen: "",
      votes: [],
      numVotes: 0,
      numPlayers: 0,
      errors: [],
      nextVoteTimestamp: 0,
      game: {},
      time: {},
    });

    return { state };
  },

  created() {
    setInterval(() => {
      this.state.time = new Date();
    }, 10);
  },

  methods: {
    formatVotes(votes) {
      let out = "";
      let i = 1;
      for (const [move, numVotes] of votes) {
        out += `${i}. ${move} (${numVotes} votes)\n`;
        i++;
      }
      return out;
    },

    signIn() {
      location.href =
        `https://login.microsoftonline.com/d72a7172-d5f8-4889-9a85-d7424751592a/oauth2/authorize?` +
        `client_id=c8115b04-01cf-451e-a9bb-95170936d45e&` +
        `redirect_uri=${location.origin}&` +
        `response_type=id_token&nonce=distributed-chess&scopes=User.Read`;
    },

    updateStatus(game) {
      console.log("update");
      let status = "";
      let moveCol = game.turn() == "w" ? "White" : "Black";

      console.log(game);

      if (game.isCheckmate()) {
        status = `Checkmate! ${moveCol} wins.`;
      } else if (game.isDraw()) {
        status = "Draw.";
      } else {
        status = `${moveCol} to move`;
        if (game.isCheck()) {
          status += `, ${moveCol} is in check.`;
        } else {
          status += ".";
        }
      }

      this.state.status = status;
    },

    initGame() {},
  },

  mounted() {
    let game = new Chess();
    this.state.game = game;
    console.log(game);

    const socket = this.$socket;
    let app = this;

    socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    socket.on("state", ({ fen, nextVoteTime }) => {
      console.log("Got state", fen);
      app.state.nextVoteTimestamp = nextVoteTime;
      app.state.game.load(fen);
      app.state.fen = fen;
      app.updateStatus(game);
    });

    socket.on(
      "gameInfo",
      ({ role: _role, playersPerGroup, gameStatus, waitingReason, group }) => {
        app.state.role = _role;
        app.state.group = group;
        if (gameStatus === "waiting") {
          if(waitingReason === "noVotes"){
            this.state.status = "Voting timeout elapsed with no votes. Restarting game.";
          }else if(waitingReason === "noPlayers"){
            this.state.status = "Waiting for more players to join.";
          }else if(waitingReason === "gameCompleted"){
            console.log(this.state.status);
          }
        } else {
          app.initGame();
        }
      }
    );

    socket.on("votes", (votes) => {
      console.log(votes);
      app.state.votes = votes;
    });

    socket.on("votingUpdate", ({ numVotes, players }) => {
      app.state.numVotes = numVotes;
      app.state.numPlayers = players;
    });

    socket.on("error", (error) => {
      console.log(error);
      app.state.errors.push(error);
    });

    if (location.hash.length !== 0) {
      localStorage.setItem("token", location.hash.substring(10).split("&")[0]);
      location.hash = "";
    }

    this.state.auth = localStorage.getItem("token");
    if (this.state.auth) {
      socket.emit("auth", this.state.auth);
    }
  },
};
</script>

<style scoped>
</style>
