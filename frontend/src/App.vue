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
            <span> <br/> </span>
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

            <!--  If game is in play, show voting timeout  -->
            <div v-if="state.gameStatus === 'playing' "
                 class="outline-none rounded p-4 bg-[#B58863] text-white text-xl"
            >
              <span>Voting window</span> <br/>

              <span class="font-mono text-md">
                {{
                  Math.max(
                      (state.nextVoteTimestamp - state.time.getTime()) / 1000,
                      0
                  ).toFixed(2)
                }}s
              </span>
              <br/>
              <span class="text-sm" v-if="state.game.turn() === state.role">
                You have not voted
              </span>
            </div>
            <!--  If waiting for game start, show countdown  -->
            <div v-else-if="state.nextGameTime > 0"
                 class="outline-none rounded p-4 bg-[#B58863] text-white text-xl"
            >
              <span>Game starts in</span> <br/>
              <span class="font-mono text-md">
                {{
                  Math.max(
                      (state.nextGameTime - state.time.getTime()) / 1000,
                      0
                  ).toFixed(2)
                }}s
              </span>
            </div>
            <!--  Waiting for players  -->
            <div v-else
                 class="outline-none rounded p-4 bg-[#B58863] text-white text-xl"
            >
              <span>Waiting for players</span> <br/>
            </div>

            <div v-if="state.gameStatus === 'playing'"
                 class="outline-none rounded p-4 bg-[#F0D9B5] text-black">
              <span class="text-xl"> {{ state.numVotes }} votes </span> <br/>
              <span> of {{ state.numPlayers }} players </span>
            </div>
            <div class="outline-none rounded p-4 bg-[#B58863] text-white text-xl">
              <span class="text-xl">Your team: {{ state.numWins[state.group] }}</span> <br/>
              <span> Other team: {{ state.numWins[state.group === 1 ? 2 : 1] }} </span>
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
        <span> <br/> </span>
        <ol class="outline outline-1 outline-[#F0D9B5] rounded w-80 p-4 h-full" v-if="state.votes.length">
          <li v-for="vote in state.votes" :key="vote">
            <span> {{ `${vote[0]} (${vote[1]} votes)\n` }}</span>
          </li>
        </ol>
        <span class="outline outline-1 outline-[#F0D9B5] rounded w-80 p-4 h-full" v-else>No votes.</span>
      </div>
    </div>

    <div v-else class="flex flex-col gap-2 mb-10">
      <span class="text-2xl">
        chess.<span class="text-nush-mid">nush</span>.app
      </span>
      <br/>
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
import {Chess} from "chess.js";

import {reactive, ref} from "vue";

export default {
  name: "App",
  components: {
    Board,
  },

  setup() {
    const state = reactive({
      group: 0,
      auth: false,
      status: "",
      // Either waiting or playing
      gameStatus: "waiting",
      nextGameTime: -1,
      role: "",
      fen: "",
      votes: [],
      numVotes: 0,
      numPlayers: 0,
      numWins: [1, 0, 0],
      errors: [],
      nextVoteTimestamp: 0,
      game: {},
      time: {},
    });

    return {state};
  },

  created() {
    setInterval(() => {
      this.state.time = new Date();
    }, 10);
  },

  methods: {

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

    initGame() {
    },
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

    socket.on("state", ({fen, nextVoteTime}) => {
      console.log("Got state", fen);
      app.state.nextVoteTimestamp = nextVoteTime;
      app.state.game.load(fen);
      app.state.fen = fen;
      app.updateStatus(game);
    });

    socket.on(
        "gameInfo",
        ({role: _role, playersPerGroup, winsPerGroup, gameStatus, waitingReason, group, nextGameTime}) => {
          app.state.role = _role;
          app.state.group = group;
          app.state.numWins = winsPerGroup;
          app.state.votes = [];
          app.state.gameStatus = gameStatus;
          app.state.nextGameTime = nextGameTime;
          if (gameStatus === "waiting") {
            if (waitingReason === "noVotes") {
              // NO need to do anything here
              // Handled by winner event
            } else if (waitingReason === "noPlayers") {
              this.state.status = "Waiting for more players to join.";
            } else if (waitingReason === "gameCompleted") {
              console.log(this.state.status);
            }
          } else {
            app.initGame();
          }

          // TODO: don't request player stats all the time
          socket.emit("playerStats", (stats) => {
            // TODO: do something with player stats
            console.log(stats);
          });
        }
    );

    socket.on("votes", (votes) => {
      console.log(votes);
      app.state.votes = votes;
    });

    socket.on("winner", ({winnerGroup, timeout}) => {
      if (timeout) {
        app.state.status = `Team ${winnerGroup} won because the other team did not vote.`;
      } else {
        app.state.status = `Team ${winnerGroup} won.`;
      }
      app.state.nextVoteTimestamp = new Date().getTime();
    });

    socket.on("votingUpdate", ({numVotes, players}) => {
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
    socket.on("connect", () => {
      if (this.state.auth) {
        socket.emit("auth", this.state.auth);
      }
    })
  },
};
</script>

<style scoped>
</style>
